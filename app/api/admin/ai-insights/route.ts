import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Cart from '@/models/Cart';
import Review from '@/models/Review';
import { ai, localInsights } from '@/lib/ai/client';
import { auth } from '@/auth';

// GET /api/admin/ai-insights — AI-generated business insights for the admin dashboard
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const periodDays = Math.min(parseInt(searchParams.get('period') || '30'), 90);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const [
      revenueByDay,
      ordersByDay,
      topProducts,
      lowStockProducts,
      newCustomers,
      returningCustomers,
      abandonedCarts,
    ] = await Promise.all([
      // Revenue by day
      Order.aggregate([
        {
          $match: { createdAt: { $gte: startDate }, 'payment.status': 'completed' },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$total' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Orders by day
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Top products
      Product.find({ status: 'active' })
        .sort({ salesCount: -1 })
        .limit(5)
        .select('name slug salesCount averageRating')
        .lean(),
      // Low stock count
      Product.countDocuments({
        status: 'active',
        trackInventory: true,
        $expr: { $lte: ['$stock', '$lowStockThreshold'] },
      }),
      // New customers (created in period)
      (await import('@/models/User')).default.countDocuments({
        role: 'user',
        createdAt: { $gte: startDate },
      }),
      // Returning customers — users with >1 order in period
      (await import('@/models/User')).default.countDocuments({
        role: 'user',
        totalOrders: { $gte: 2 },
      }),
      // Abandoned carts (updated in period but no order link & not empty)
      Cart.countDocuments({
        lastActivity: { $gte: startDate },
        'items.0': { $exists: true },
      }),
    ]);

    const revenueByDayFormatted = revenueByDay.map((d: any) => ({
      date: d._id,
      revenue: d.revenue,
    }));
    const days = revenueByDayFormatted.length;
    const ordersSeries = ordersByDay.map((d: any) => d.orders);

    const payload = {
      period_days: periodDays,
      revenueByDay: revenueByDayFormatted,
      orders: ordersSeries,
      top_products: topProducts.map((p: any) => ({ name: p.name, sales: p.salesCount })),
      low_stock_products: lowStockProducts,
      new_customers: newCustomers,
      returning_customers: returningCustomers,
      abandoned_carts: abandonedCarts,
    };

    // Try the AI service, fall back to the deterministic local engine.
    const result = (await ai.insights(payload, periodDays)) || localInsights(payload as any, periodDays);

    return NextResponse.json({
      ...result,
      source: result.forecast ? 'ai_service' : 'local_fallback',
      days,
    });
  } catch (error: any) {
    console.error('AI insights error:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI insights' },
      { status: 500 }
    );
  }
}