import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongodb';
import Order from '@/models/Order';
import { auth } from '@/auth';

// GET - Get single order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const session = await auth();

    await connectDB();

    const { orderNumber } = await params;

    const order = await Order.findOne({ orderNumber })
      .populate('user', 'name email phone')
      .populate('items.product', 'name slug images')
      .lean();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check authorization
    if (session?.user?.role !== 'admin' && session?.user?.role !== 'superadmin') {
      if (order.user && session?.user?.id !== order.user._id.toString()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

// PATCH - Update order status (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { orderNumber } = await params;
    const body = await request.json();

    const order = await Order.findOne({ orderNumber });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Update fields
    const allowedUpdates = [
      'status',
      'payment.status',
      'payment.transactionId',
      'shipping.carrier',
      'shipping.trackingNumber',
      'shipping.trackingUrl',
      'shipping.actualDelivery',
    ];

    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        const keys = key.split('.');
        if (keys.length === 2) {
          (order as any)[keys[0]][keys[1]] = body[key];
        } else {
          (order as any)[key] = body[key];
        }
      }
    }

    // Add timeline entry
    if (body.status && body.status !== order.status) {
      const statusMessages: Record<string, string> = {
        confirmed: 'Order has been confirmed',
        processing: 'Order is being processed',
        packed: 'Order has been packed',
        shipped: 'Order has been shipped',
        out_for_delivery: 'Order is out for delivery',
        delivered: 'Order has been delivered',
        cancelled: 'Order has been cancelled',
        returned: 'Order return initiated',
        refunded: 'Order has been refunded',
      };

      order.timeline.push({
        status: body.status,
        message: body.statusMessage || statusMessages[body.status] || `Status changed to ${body.status}`,
        timestamp: new Date(),
        updatedBy: new mongoose.Types.ObjectId(session.user.id),
      });

      // Update specific dates
      if (body.status === 'delivered') {
        order.shipping.actualDelivery = new Date();
      }
    }

    // Handle payment status update
    if (body['payment.status'] === 'completed' && order.payment.status !== 'completed') {
      order.payment.paidAt = new Date();
      order.payment.paidAmount = order.total;
    }

    await order.save();

    return NextResponse.json({
      message: 'Order updated successfully',
      order,
    });
  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update order' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel order (User can cancel within allowed window)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { orderNumber } = await params;
    const body = await request.json();

    const order = await Order.findOne({ orderNumber });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check authorization
    const isAdmin = session.user.role === 'admin' || session.user.role === 'superadmin';
    const isOwner = order.user && session.user.id === order.user.toString();

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if order can be cancelled
    const cancellableStatuses = ['pending', 'confirmed', 'processing'];
    if (!cancellableStatuses.includes(order.status)) {
      return NextResponse.json(
        { error: 'This order cannot be cancelled at this stage' },
        { status: 400 }
      );
    }

    // Update order status
    order.status = 'cancelled';
    order.timeline.push({
      status: 'cancelled',
      message: body.reason || 'Order cancelled by ' + (isAdmin ? 'admin' : 'customer'),
      timestamp: new Date(),
      updatedBy: new mongoose.Types.ObjectId(session.user.id),
    });

    // Restore inventory
    const Product = (await import('@/models/Product')).default;
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        if (product.hasVariants && item.variant) {
          const variant = product.variants?.find((v: any) => v._id?.toString() === item.variant?.toString());
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

    // Restore loyalty points if used
    if (order.loyaltyPointsUsed > 0 && order.user) {
      const User = (await import('@/models/User')).default;
      await User.findByIdAndUpdate(order.user, {
        $inc: { loyaltyPoints: order.loyaltyPointsUsed },
      });
    }

    await order.save();

    return NextResponse.json({
      message: 'Order cancelled successfully',
      order,
    });
  } catch (error: any) {
    console.error('Error cancelling order:', error);
    return NextResponse.json(
      { error: 'Failed to cancel order' },
      { status: 500 }
    );
  }
}
