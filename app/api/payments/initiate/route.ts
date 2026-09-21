import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Order from '@/models/Order';
import { auth } from '@/auth';
import { initSSLCommerzPayment } from '@/lib/payments/sslcommerz';
import { createBkashPayment } from '@/lib/payments/bkash';
import { initNagadPayment } from '@/lib/payments/nagad';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const session = await auth();
    const body = await request.json();

    const { orderNumber, paymentMethod } = body;

    if (!orderNumber || !paymentMethod) {
      return NextResponse.json(
        { error: 'Order number and payment method are required' },
        { status: 400 }
      );
    }

    const order = await Order.findOne({ orderNumber });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify ownership
    if (order.user && session?.user?.id !== order.user.toString()) {
      if (session?.user?.role !== 'admin' && session?.user?.role !== 'superadmin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Check if already paid
    if (order.payment.status === 'completed') {
      return NextResponse.json(
        { error: 'Order is already paid' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let result;

    switch (paymentMethod) {
      case 'sslcommerz':
        result = await initSSLCommerzPayment({
          order,
          customerName: order.shippingAddress.fullName,
          customerEmail: order.shippingAddress.email || order.guestEmail || '',
          customerPhone: order.shippingAddress.phone,
          customerAddress: order.shippingAddress.street,
          customerCity: order.shippingAddress.city,
          customerPostcode: order.shippingAddress.postalCode,
          customerCountry: order.shippingAddress.country,
        });

        if (result.success) {
          order.payment.method = 'sslcommerz';
          order.payment.status = 'processing';
          await order.save();

          return NextResponse.json({
            success: true,
            redirectUrl: result.gatewayPageURL,
          });
        }
        break;

      case 'bkash':
        result = await createBkashPayment({
          orderId: order.orderNumber,
          amount: order.total,
          payerReference: order.shippingAddress.phone,
          callbackURL: `${appUrl}/api/payments/bkash/callback`,
        });

        if (result.success) {
          order.payment.method = 'bkash';
          order.payment.status = 'processing';
          order.payment.transactionId = result.paymentID;
          await order.save();

          return NextResponse.json({
            success: true,
            redirectUrl: result.bkashURL,
            paymentID: result.paymentID,
          });
        }
        break;

      case 'nagad':
        result = await initNagadPayment({
          orderId: order.orderNumber,
          amount: order.total,
          callbackURL: `${appUrl}/api/payments/nagad/callback`,
        });

        if (result.success) {
          order.payment.method = 'nagad';
          order.payment.status = 'processing';
          order.payment.transactionId = result.paymentReferenceId;
          await order.save();

          return NextResponse.json({
            success: true,
            redirectUrl: result.callBackUrl,
          });
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid payment method' },
          { status: 400 }
        );
    }

    return NextResponse.json(
      { error: result?.error || 'Payment initiation failed' },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Payment initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate payment' },
      { status: 500 }
    );
  }
}
