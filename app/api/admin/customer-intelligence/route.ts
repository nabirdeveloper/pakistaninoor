import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import { auth } from '@/auth';
import { computeCustomerIntelligence } from '@/lib/ai/customerIntelligence';

// GET /api/admin/customer-intelligence — retention & churn intelligence
//  - CLV per customer from completed order history
//  - Churn risk scoring (recency + frequency) with deterministic playbooks
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

    // Order statuses that count as real purchases for CLV/churn modelling.
    const countedStatuses = ['delivered', 'shipped', 'out_for_delivery', 'processing', 'confirmed', 'pending'];

    const [orderAggs, users] = await Promise.all([
      Order.aggregate([
        { $match: { user: { $ne: null }, status: { $in: countedStatuses } } },
        {
          $group: {
            _id: '$user',
            totalSpend: { $sum: '$total' },
            orderCount: { $sum: 1 },
            lastOrderAt: { $max: '$createdAt' },
            avgOrderValue: { $avg: '$total' },
          },
        },
      ]),
      User.find({ role: 'user' })
        .select('name email image createdAt totalSpent totalOrders')
        .lean(),
    ]);

    const aggByUser = new Map(
      (orderAggs as any[]).map((a) => [
        a._id.toString(),
        {
          totalSpend: a.totalSpend || 0,
          orderCount: a.orderCount || 0,
          lastOrderAt: a.lastOrderAt,
          avgOrderValue: a.avgOrderValue || 0,
        },
      ])
    );

    const customerRows = (users as any[])
      .filter((u) => aggByUser.has(u._id.toString()) || (u.totalSpent || 0) > 0)
      .map((u) => {
        const agg = aggByUser.get(u._id.toString()) || {
          totalSpend: u.totalSpent || 0,
          orderCount: u.totalOrders || 0,
          lastOrderAt: undefined,
          avgOrderValue: u.totalOrders ? (u.totalSpent || 0) / u.totalOrders : 0,
        };
        return {
          userId: u._id.toString(),
          name: u.name || 'Unknown customer',
          email: u.email || '',
          image: u.image,
          accountCreatedAt: u.createdAt,
          orderAgg: agg,
        };
      });

    const intelligence = computeCustomerIntelligence(customerRows);

    return NextResponse.json({
      ...intelligence,
      source: 'deterministic',
      limit,
    });
  } catch (error: any) {
    console.error('Customer intelligence error:', error);
    return NextResponse.json(
      { error: 'Failed to generate customer intelligence' },
      { status: 500 }
    );
  }
}