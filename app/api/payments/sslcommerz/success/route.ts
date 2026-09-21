import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Order from '@/models/Order';
import { validateSSLCommerzPayment } from '@/lib/payments/sslcommerz';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const formData = await request.formData();
    const valId = formData.get('val_id') as string;
    const tranId = formData.get('tran_id') as string;
    const status = formData.get('status') as string;

    if (status !== 'VALID' && status !== 'VALIDATED') {
      return NextResponse.redirect(
        new URL(`/checkout/failed?order=${tranId}&reason=invalid_status`, process.env.NEXT_PUBLIC_APP_URL!)
      );
    }

    // Validate the payment
    const validation = await validateSSLCommerzPayment(valId);

    if (!validation.valid) {
      return NextResponse.redirect(
        new URL(`/checkout/failed?order=${tranId}&reason=validation_failed`, process.env.NEXT_PUBLIC_APP_URL!)
      );
    }

    // Update order
    const order = await Order.findOne({ orderNumber: tranId });

    if (!order) {
      return NextResponse.redirect(
        new URL(`/checkout/failed?order=${tranId}&reason=order_not_found`, process.env.NEXT_PUBLIC_APP_URL!)
      );
    }

    // Verify amount
    if (parseFloat(validation.data.amount) !== order.total) {
      return NextResponse.redirect(
        new URL(`/checkout/failed?order=${tranId}&reason=amount_mismatch`, process.env.NEXT_PUBLIC_APP_URL!)
      );
    }

    // Update payment status
    order.payment.status = 'completed';
    order.payment.transactionId = validation.data.bank_tran_id;
    order.payment.paidAt = new Date();
    order.payment.paidAmount = parseFloat(validation.data.amount);
    order.payment.gatewayResponse = validation.data;

    // Update order status
    order.status = 'confirmed';
    order.timeline.push({
      status: 'confirmed',
      message: 'Payment received via SSLCommerz',
      timestamp: new Date(),
    });

    await order.save();

    return NextResponse.redirect(
      new URL(`/checkout/success?order=${tranId}`, process.env.NEXT_PUBLIC_APP_URL!)
    );
  } catch (error: any) {
    console.error('SSLCommerz success callback error:', error);
    return NextResponse.redirect(
      new URL('/checkout/failed?reason=server_error', process.env.NEXT_PUBLIC_APP_URL!)
    );
  }
}
