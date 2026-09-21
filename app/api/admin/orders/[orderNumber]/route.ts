import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Order from '@/models/Order';
import { notifyUser } from '@/lib/notifications/push';

/** Order status → notification type/title mapping (Phase 4). */
const ORDER_STATUS_NOTIFICATION: Record<
  string,
  { type: 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'order_cancelled' | 'refund_processed'; title: string; message: (orderNumber: string) => string }
> = {
  confirmed: {
    type: 'order_confirmed',
    title: 'Order confirmed 🎉',
    message: (n) => `Great news — your order ${n} is confirmed. We'll keep you posted every step of the way.`,
  },
  shipped: {
    type: 'order_shipped',
    title: 'Your order is on the way 📦',
    message: (n) => `Your order ${n} has shipped. Track it anytime from My Orders.`,
  },
  delivered: {
    type: 'order_delivered',
    title: 'Order delivered ✅',
    message: (n) => `Your order ${n} has been delivered. Enjoy! If anything's not right, our 7-day return policy has you covered.`,
  },
  cancelled: {
    type: 'order_cancelled',
    title: 'Order cancelled',
    message: (n) => `Your order ${n} was cancelled. Refunds (if any) are processed within 3-5 working days.`,
  },
  refunded: {
    type: 'refund_processed',
    title: 'Refund processed 💸',
    message: (n) => `A refund for order ${n} has been processed. It should reach you within 3-5 working days.`,
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const { orderNumber } = await params;

    const order = await Order.findOne({ orderNumber })
      .populate('user', 'name email phone')
      .populate('items.product', 'name slug images sku price')
      .lean();

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('Admin order fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const { orderNumber } = await params;
    const body = await request.json();
    const { status, statusNote, trackingNumber, courierName, adminNotes, paymentStatus } = body;

    const order = await Order.findOne({ orderNumber });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const previousStatus = order.status;

    // Update status and add to timeline
    if (status && status !== order.status) {
      order.status = status;
      order.timeline.push({
        status,
        message: statusNote || `Order status changed to ${status}`,
        timestamp: new Date(),
        updatedBy: new mongoose.Types.ObjectId(session.user.id),
      });
    }

    // Restore inventory + loyalty points when an order is cancelled/returned/refunded
    const STOCK_RESTORE_STATUSES = ['cancelled', 'returned', 'refunded'];
    if (
      status &&
      status !== previousStatus &&
      STOCK_RESTORE_STATUSES.includes(status) &&
      !STOCK_RESTORE_STATUSES.includes(previousStatus)
    ) {
      const Product = (await import('@/models/Product')).default;
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          if (product.hasVariants && item.variant) {
            const variant = product.variants?.find(
              (v: any) => v._id?.toString() === item.variant?.toString()
            );
            if (variant) {
              variant.stock += item.quantity;
            }
          } else if (product.trackInventory) {
            product.stock += item.quantity;
          }
          product.salesCount = Math.max(0, product.salesCount - item.quantity);
          await product.save();
        }
      }
      if (order.loyaltyPointsUsed > 0 && order.user) {
        const User = (await import('@/models/User')).default;
        await User.findByIdAndUpdate(order.user, {
          $inc: { loyaltyPoints: order.loyaltyPointsUsed },
        });
      }
    }

    // Update tracking info
    if (trackingNumber !== undefined) {
      order.shipping.trackingNumber = trackingNumber;
    }
    if (courierName !== undefined) {
      order.shipping.carrier = courierName;
    }

    // Update order notes
    if (adminNotes !== undefined) {
      order.orderNotes = adminNotes;
    }

    // Update payment status
    if (paymentStatus) {
      order.payment.status = paymentStatus;
      if (paymentStatus === 'completed' && !order.payment.paidAt) {
        order.payment.paidAt = new Date();
      }
    }

    await order.save();

    // Phase 4: notify the customer when their order moves to a notify-worthy status
    if (status && status !== previousStatus && order.user) {
      const mapping = ORDER_STATUS_NOTIFICATION[status];
      if (mapping) {
        try {
          await notifyUser({
            userId: order.user,
            type: mapping.type,
            title: mapping.title,
            message: mapping.message(order.orderNumber),
            link: '/account/orders',
            data: { orderNumber: order.orderNumber, status },
          });
        } catch (notifyError) {
          console.error('Order status notification failed (status still saved):', notifyError);
        }
      }
    }

    // Populate for response
    await order.populate('user', 'name email phone');
    await order.populate('items.product', 'name slug images sku price');

    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('Admin order update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update order' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { orderNumber } = await params;

    const order = await Order.findOneAndDelete({ orderNumber });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Order deleted successfully' });
  } catch (error: any) {
    console.error('Admin order delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete order' },
      { status: 500 }
    );
  }
}
