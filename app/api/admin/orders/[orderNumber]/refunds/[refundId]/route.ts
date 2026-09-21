import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Order from '@/models/Order';
import { notifyUser } from '@/lib/notifications/push';

/**
 * PATCH /api/admin/orders/:orderNumber/refunds/:refundId
 * Body: { action: 'approve' | 'reject' | 'complete', statusMessage?: string, transactionId?: string }
 *
 *  - approve  → mark refund as approved (awaiting payment release)
 *  - reject   → mark refund as rejected
 *  - complete → mark refund paid; sets payment.status = 'refunded';
 *               if the refund covers the full order total the order status
 *               also becomes 'refunded' and the customer is notified.
 */
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ orderNumber: string; refundId: string }>;
  }
) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const { orderNumber, refundId } = await params;
    const body = await request.json();
    const { action, statusMessage, transactionId } = body;

    if (!['approve', 'reject', 'complete'].includes(action)) {
      return NextResponse.json(
        { error: "Action must be 'approve', 'reject' or 'complete'" },
        { status: 400 }
      );
    }

    const order = await Order.findOne({ orderNumber });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const refund = (order.refunds || []).find(
      (r: any) => r._id?.toString() === refundId
    );
    if (!refund) {
      return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
    }

    if (refund.status === 'completed') {
      return NextResponse.json(
        { error: 'This refund has already been completed' },
        { status: 400 }
      );
    }

    const adminId = new mongoose.Types.ObjectId(session.user.id);

    if (action === 'approve') {
      if (refund.status !== 'pending') {
        return NextResponse.json(
          { error: 'Only a pending refund can be approved' },
          { status: 400 }
        );
      }
      refund.status = 'approved';
      order.timeline.push({
        status: order.status,
        message:
          statusMessage ||
          `Refund of ৳${refund.amount.toLocaleString()} approved`,
        timestamp: new Date(),
        updatedBy: adminId,
      });
    } else if (action === 'reject') {
      if (refund.status !== 'pending') {
        return NextResponse.json(
          { error: 'Only a pending refund can be rejected' },
          { status: 400 }
        );
      }
      refund.status = 'rejected';
      order.timeline.push({
        status: order.status,
        message:
          statusMessage ||
          `Refund of ৳${refund.amount.toLocaleString()} rejected`,
        timestamp: new Date(),
        updatedBy: adminId,
      });
    } else {
      // complete
      refund.status = 'completed';
      refund.processedAt = new Date();
      refund.processedBy = adminId;
      if (transactionId) refund.transactionId = transactionId;

      order.payment.status = 'refunded';
      order.payment.paidAt = order.payment.paidAt || new Date();

      if (refund.amount >= order.total) {
        order.status = 'refunded';
      }

      order.timeline.push({
        status: order.status,
        message:
          statusMessage ||
          `Refund of ৳${refund.amount.toLocaleString()} completed`,
        timestamp: new Date(),
        updatedBy: adminId,
      });

      // Notify the customer
      if (order.user) {
        try {
          await notifyUser({
            userId: order.user,
            type: 'refund_processed',
            title: 'Refund processed 💸',
            message: `A refund of ৳${refund.amount.toLocaleString()} for order ${order.orderNumber} has been completed. It should reach you within 3-5 working days.`,
            link: '/account/orders',
            data: { orderNumber: order.orderNumber, refundAmount: refund.amount },
          });
        } catch (notifyError) {
          console.error(
            'Refund notification failed (refund still saved):',
            notifyError
          );
        }
      }
    }

    await order.save();

    return NextResponse.json({ refund, order });
  } catch (error: any) {
    console.error('Refund action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update refund' },
      { status: 500 }
    );
  }
}