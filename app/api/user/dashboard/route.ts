import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import User from '@/models/User';
import Order from '@/models/Order';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const [user, recentOrders, orderStats] = await Promise.all([
      User.findById(session.user.id).select('addresses wishlist loyaltyPoints totalOrders totalSpent'),
      Order.find({ user: session.user.id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderNumber total status createdAt items.name items.image'),
      Order.aggregate([
        { $match: { user: session.user.id } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: '$total' },
          },
        },
      ]),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const stats = orderStats[0] || { totalOrders: 0, totalSpent: 0 };

    return NextResponse.json({
      totalOrders: stats.totalOrders,
      totalSpent: stats.totalSpent,
      wishlistCount: user.wishlist?.length || 0,
      addressCount: user.addresses?.length || 0,
      loyaltyPoints: user.loyaltyPoints || 0,
      recentOrders: recentOrders.map((order) => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
        items: order.items.map((item: any) => ({
          name: item.name,
          image: item.image,
        })),
      })),
    });
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
