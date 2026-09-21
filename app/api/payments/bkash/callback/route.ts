import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Order from '@/models/Order';
import { executeBkashPayment } from '@/lib/payments/bkash';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const paymentID = searchParams.get('paymentID');
    const status = searchParams.get('status');

    if (!paymentID) {
      return NextResponse.redirect(
        new URL('/checkout/failed?reason=missing_payment_id', process.env.NEXT_PUBLIC_APP_URL!)
      );
    }

    // Find order by payment ID
    const order = await Order.findOne({ 'payment.transactionId': paymentID });

    if (!order) {
      return NextResponse.redirect(
        new URL('/checkout/failed?reason=order_not_found', process.env.NEXT_PUBLIC_APP_URL!)
      );
    }

    if (status === 'cancel') {
      order.payment.status = 'cancelled';
      order.timeline.push({
        status: 'payment_cancelled',
        message: 'Payment cancelled by user',
        timestamp: new Date(),
      });
      await order.save();

      return NextResponse.redirect(
        new URL(`/checkout/failed?order=${order.orderNumber}&reason=cancelled`, process.env.NEXT_PUBLIC_APP_URL!)
      );
    }

    if (status === 'failure') {
      order.payment.status = 'failed';
      order.timeline.push({
        status: 'payment_failed',
        message: 'bKash payment failed',
        timestamp: new Date(),
      });
      await order.save();

      return NextResponse.redirect(
        new URL(`/checkout/failed?order=${order.orderNumber}&reason=payment_failed`, process.env.NEXT_PUBLIC_APP_URL!)
      );
    }

    // Execute the payment
    const result = await executeBkashPayment(paymentID);

    if (!result.success) {
      order.payment.status = 'failed';
      order.timeline.push({
        status: 'payment_failed',
        message: result.error || 'bKash payment execution failed',
        timestamp: new Date(),
      });
      await order.save();

      return NextResponse.redirect(
        new URL(`/checkout/failed?order=${order.orderNumber}&reason=execution_failed`, process.env.NEXT_PUBLIC_APP_URL!)
      );
    }

    // Verify amount
    if (parseFloat(result.data.amount) !== order.total) {
      return NextResponse.redirect(
        new URL(`/checkout/failed?order=${order.orderNumber}&reason=amount_mismatch`, process.env.NEXT_PUBLIC_APP_URL!)
      );
    }

    // Update order
    order.payment.status = 'completed';
    order.payment.transactionId = result.transactionId;
    order.payment.paidAt = new Date();
    order.payment.paidAmount = parseFloat(result.data.amount);
    order.payment.gatewayResponse = result.data;

    order.status = 'confirmed';
    order.timeline.push({
      status: 'confirmed',
      message: 'Payment received via bKash',
      timestamp: new Date(),
    });

    await order.save();

    return NextResponse.redirect(
      new URL(`/checkout/success?order=${order.orderNumber}`, process.env.NEXT_PUBLIC_APP_URL!)
    );
  } catch (error: any) {
    console.error('bKash callback error:', error);
    return NextResponse.redirect(
      new URL('/checkout/failed?reason=server_error', process.env.NEXT_PUBLIC_APP_URL!)
    );
  }
}
