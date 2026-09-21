import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Order from '@/models/Order';

/**
 * POST /api/admin/orders/:orderNumber/refunds
 * Body: { amount: number, reason: string }
 * Creates a PENDING refund against the order. Amount must be positive and
 * must not exceed the order total (minus previously approved/completed refunds).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const { orderNumber } = await params;
    const body = await request.json();
    const { amount, reason } = body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'A positive refund amount is required' },
        { status: 400 }
      );
    }
    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'A refund reason is required' },
        { status: 400 }
      );
    }

    const order = await Order.findOne({ orderNumber });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const alreadyRefunded = (order.refunds || []).reduce(
      (sum: number, r: any) =>
        r.status === 'approved' || r.status === 'completed'
          ? sum + (r.amount || 0)
          : sum,
      0
    );

    if (alreadyRefunded + amount > order.total) {
      return NextResponse.json(
        {
          error: `Refund amount exceeds order total. Already refunded ৳${alreadyRefunded.toLocaleString()}, order total ৳${order.total.toLocaleString()}.`,
        },
        { status: 400 }
      );
    }

    const refund: any = {
      amount: Math.round(amount * 100) / 100,
      reason: reason.trim(),
      status: 'pending',
      processedBy: new mongoose.Types.ObjectId(session.user.id),
      createdAt: new Date(),
    };

    if (!order.refunds) order.refunds = [];
    order.refunds.push(refund);

    order.timeline.push({
      status: order.status,
      message: `Refund of ৳${refund.amount.toLocaleString()} requested — ${refund.reason}`,
      timestamp: new Date(),
      updatedBy: new mongoose.Types.ObjectId(session.user.id),
    });

    await order.save();

    const created = order.refunds[order.refunds.length - 1];

    return NextResponse.json({ refund: created }, { status: 201 });
  } catch (error: any) {
    console.error('Refund creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create refund' },
      { status: 500 }
    );
  }
}