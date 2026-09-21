import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { auth } from '@/auth';
import Order from '@/models/Order';
import Product from '@/models/Product';
import TrafficEvent from '@/models/TrafficEvent';
import {
  forecastRevenue,
  computeCohortIntelligence,
  computeTrafficIntelligence,
  computeProductAttention,
  generateStoreInsights,
  type CohortRow,
  type TrafficEventLite,
} from '@/lib/ai/storeIntelligence';

// Statuses that count as real sale revenue for forecasting.
const REVENUE_STATUSES = [
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
];
// Statuses excluded entirely from cohort activity (never a real purchase).
const EXCLUDED_STATUSES = ['cancelled', 'refunded', 'returned'];

const primaryImage = (p: any) =>
  p?.images?.find((i: any) => i.isPrimary)?.url || p?.images?.[0]?.url || '';

/**
 * GET /api/admin/store-intelligence?days=30
 *
 * Predictive + behavioural store intelligence:
 *   - revenue forecast (90-day history → next 14 days with confidence band)
 *   - monthly new-customer cohorts with retention + revenue
 *   - traffic/session intelligence from the TrafficEvent feed
 *   - product attention signals (rising / seen-but-not-bought)
 *   - deterministic insight feed tying it together
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const days = Math.min(
      90,
      Math.max(7, parseInt(request.nextUrl.searchParams.get('days') || '30') || 30)
    );

    const now = new Date();
    const from = new Date(now.getTime() - days * 86_400_000);
    from.setHours(0, 0, 0, 0);

    // Prior window of equal length (for attention delta comparison).
    const priorFrom = new Date(from.getTime() - days * 86_400_000);
    const priorTo = from;

    // Revenue history over the last 90 days (stable forecast training window).
    const forecastFrom = new Date(now.getTime() - 90 * 86_400_000);
    forecastFrom.setHours(0, 0, 0, 0);

    const [
      dailyRevenueAgg,
      periodTotals,
      cohortOrders,
      trafficEvents,
      windowViews,
      priorViews,
    ] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: forecastFrom }, status: { $in: REVENUE_STATUSES } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$total' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: now }, status: { $in: REVENUE_STATUSES } } },
        { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
      ]),
      // Cohort rows: one per non-cancelled order in the last 24 months.
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(now.getTime() - 24 * 30 * 86_400_000) },
            status: { $nin: EXCLUDED_STATUSES },
          },
        },
        { $project: { user: 1, guestEmail: 1, total: 1, createdAt: 1 } },
        { $sort: { createdAt: 1 } },
        { $limit: 5000 },
      ]),
      // Traffic feed over the selected window (bounded for session analysis).
      TrafficEvent.find({
        createdAt: { $gte: from, $lte: now },
        $or: [{ sessionId: { $exists: true, $ne: null } }, { userId: { $exists: true, $ne: null } }],
      })
        .select('type sessionId userId productId categoryId path source createdAt')
        .sort({ createdAt: -1 })
        .limit(4000)
        .lean(),
      // Product views in the window.
      TrafficEvent.aggregate([
        { $match: { type: 'product_view', createdAt: { $gte: from, $lte: now } } },
        { $group: { _id: '$productId', count: { $sum: 1 }, categoryId: { $first: '$categoryId' } } },
      ]),
      // Product views in the prior equal window.
      TrafficEvent.aggregate([
        { $match: { type: 'product_view', createdAt: { $gte: priorFrom, $lt: priorTo } } },
        { $group: { _id: '$productId', count: { $sum: 1 } } },
      ]),
    ]);

    // ---- Forecast ----
    const dailyRevenue = (dailyRevenueAgg as any[]).map((d) => ({
      date: d._id,
      revenue: d.revenue || 0,
    }));
    const forecast = forecastRevenue(dailyRevenue, 14);

    // ---- Cohorts ----
    const cohortRows: CohortRow[] = (cohortOrders as any[])
      .map((o: any) => {
        const identity = o.user
          ? String(o.user)
          : o.guestEmail
            ? `guest:${String(o.guestEmail).toLowerCase()}`
            : '';
        if (!identity) return null;
        return {
          identity,
          createdAt: new Date(o.createdAt),
          total: Number(o.total) || 0,
        };
      })
      .filter(Boolean) as CohortRow[];
    const cohorts = computeCohortIntelligence(cohortRows, 8);

    // ---- Traffic / sessions ----
    const trafficInput: TrafficEventLite[] = (trafficEvents as any[]).map((ev) => ({
      type: ev.type,
      sessionId: ev.sessionId,
      userId: ev.userId ? String(ev.userId) : undefined,
      productId: ev.productId ? String(ev.productId) : undefined,
      categoryId: ev.categoryId ? String(ev.categoryId) : undefined,
      path: ev.path,
      source: ev.source,
      createdAt: new Date(ev.createdAt),
    }));
    const traffic = computeTrafficIntelligence(trafficInput);

    // ---- Product attention ----
    const windowViewsMap = new Map(
      (windowViews as any[]).map((v) => [String(v._id), v.count])
    );
    const priorViewsMap = new Map((priorViews as any[]).map((v) => [String(v._id), v.count]));
    const productIds = new Set([
      ...windowViewsMap.keys(),
      ...priorViewsMap.keys(),
    ]);
    const products = productIds.size
      ? await Product.find({ _id: { $in: [...productIds] } })
          .select('name slug price images salesCount status')
          .lean()
      : [];
    const productMeta = new Map(
      products.map((p: any) => [
        String(p._id),
        {
          name: p.name,
          slug: p.slug,
          price: p.price,
          image: primaryImage(p),
          salesCount: p.salesCount || 0,
        },
      ])
    );
    const attention = computeProductAttention(
      (windowViews as any[]).map((v) => ({
        productId: String(v._id),
        count: v.count,
      })),
      (priorViews as any[]).map((v) => ({ productId: String(v._id), count: v.count })),
      productMeta
    );

    // ---- Insights ----
    const periodTotal = periodTotals[0] || { revenue: 0, orders: 0 };
    const insights = generateStoreInsights({
      forecast,
      cohorts,
      traffic,
      attention,
      periodDays: days,
      ordersInPeriod: periodTotal.orders || 0,
      revenueInPeriod: periodTotal.revenue || 0,
    });

    return NextResponse.json({
      generatedAt: now.toISOString(),
      source: 'store-intelligence:deterministic',
      range: { from, to: now, days },
      forecast,
      cohorts,
      traffic,
      eventsByType: (trafficInput as any[]).reduce((acc: Record<string, number>, ev: any) => {
        acc[ev.type] = (acc[ev.type] || 0) + 1;
        return acc;
      }, {}),
      attention: attention.slice(0, 12),
      periods: {
        orders: periodTotal.orders || 0,
        revenue: Math.round(periodTotal.revenue || 0),
      },
      insights,
    });
  } catch (error: any) {
    console.error('Store intelligence error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load store intelligence' },
      { status: 500 }
    );
  }
}