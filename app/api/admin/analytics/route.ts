import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import User from '@/models/User';
import Cart from '@/models/Cart';
import TrafficEvent from '@/models/TrafficEvent';

// Statuses that count as completed sales revenue.
const REVENUE_STATUSES = [
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
];

const round = (n: number, precision = 2) => {
  const f = Math.pow(10, precision);
  return Math.round(n * f) / f;
};

const primaryImage = (p: any) =>
  p?.images?.find((i: any) => i.isPrimary)?.url || p?.images?.[0]?.url || '';

// ---------------------------------------------------------------------------
// Slow-moving, range-independent aggregates
// ---------------------------------------------------------------------------
// Lifetime CLV inputs (all-time revenue + distinct customers) and the
// retention base (customers active *before* the window) re-scan the entire
// order history on every request. They only change when orders are created,
// so memoizing them for a few minutes drops that history scan down to one
// occasional pass instead of one per hit. Admin-only endpoint, so freshness
// lag of ≤5 minutes on lifetime numbers is acceptable.
const SLOW_TTL = 5 * 60 * 1000;
const slowCache = new Map<string, { at: number; value: unknown }>();

async function slowMemo<T>(key: string, fn: () => T | Promise<T>): Promise<T> {
  const hit = slowCache.get(key);
  if (hit && Date.now() - hit.at < SLOW_TTL) return hit.value as T;
  const value = await fn();
  slowCache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * GET /api/admin/analytics?days=30
 *
 * Aggregates sales / product / customer analytics and the conversion funnel
 * over the last N days:
 *  - totals: revenue, orders, units sold, AOV, gross/net margin, refund rate
 *  - revenue-by-day + units-by-day series
 *  - sales by category, top products, payment methods, top cities
 *  - productAnalytics: most viewed / most purchased / most wishlisted,
 *    low-performing products and best-converting products
 *  - customerAnalytics: acquisition, retention, churn, CLV, repeat purchase
 *  - funnel: visitors → product views → add to cart → checkout → payment → order
 *
 * Performance notes:
 *  - Aggregations sharing the same source + match are merged with $facet so
 *    the collection is scanned once instead of once per metric.
 *  - All-time/lifetime aggregates are TTL-memoized (see slowMemo above).
 *  - Product sorting aggregates run in MongoDB instead of loading every
 *    active product into memory.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const days = Math.min(
      365,
      Math.max(1, parseInt(request.nextUrl.searchParams.get('days') || '30') || 30)
    );
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);
    const to = new Date();

    const rangeMatch = { createdAt: { $gte: from, $lte: to } };
    const revenueMatch = {
      createdAt: { $gte: from, $lte: to },
      status: { $in: REVENUE_STATUSES },
    };

    const [
      totals,
      daySeriesFacet,
      salesByCategory,
      topProducts,
      paymentMethods,
      topCities,
      refundClaimed,
      cogsAgg,
      userOrderCounts,
      activeBeforeAgg,
      trafficFacet,
      cartSessions,
      cartsCreated,
      orderSessions,
      acquisitionByDay,
      clvAgg,
      hourlyAgg,
      weekdayAgg,
      couponAgg,
      refundsFacet,
      topRegisteredCustomers,
      topGuestCustomers,
      orderSourcesAgg,
    ] = await Promise.all([
      // Order + revenue + units rollup
      Order.aggregate([
        { $match: rangeMatch },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: {
              $sum: { $cond: [{ $in: ['$status', REVENUE_STATUSES] }, '$total', 0] },
            },
            units: {
              $sum: {
                $cond: [
                  { $in: ['$status', REVENUE_STATUSES] },
                  {
                    $reduce: {
                      input: '$items',
                      initialValue: 0,
                      in: { $add: ['$$value', '$$this.quantity'] },
                    },
                  },
                  0,
                ],
              },
            },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            returned: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] } },
            refunded: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            payFailed: {
              $sum: { $cond: [{ $eq: ['$payment.status', 'failed'] }, 1, 0] },
            },
            couponDiscount: { $sum: { $ifNull: ['$couponDiscount', 0] } },
            couponOrders: {
              $sum: { $cond: [{ $ifNull: ['$couponCode', false] }, 1, 0] },
            },
            loyaltyEarned: { $sum: { $ifNull: ['$loyaltyPointsEarned', 0] } },
            loyaltyUsed: { $sum: { $ifNull: ['$loyaltyPointsUsed', 0] } },
          },
        },
      ]),

      // Daily revenue + units series in a single pass over the same orders
      Order.aggregate([
        { $match: revenueMatch },
        {
          $facet: {
            revenue: [
              {
                $group: {
                  _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                  revenue: { $sum: '$total' },
                  orders: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            units: [
              { $unwind: '$items' },
              {
                $group: {
                  _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                  units: { $sum: '$items.quantity' },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]),

      // Sales by category (joins product → category)
      Order.aggregate([
        { $match: revenueMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            revenue: { $sum: '$items.total' },
            units: { $sum: '$items.quantity' },
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$product.category', revenue: { $sum: '$revenue' }, units: { $sum: '$units' } } },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            name: { $ifNull: ['$category.name', 'Uncategorized'] },
            revenue: 1,
            units: 1,
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 15 },
      ]),

      // Top products by revenue
      Order.aggregate([
        { $match: revenueMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.slug',
            name: { $first: '$items.name' },
            unitsSold: {
              $sum: {
                $cond: [{ $in: ['$status', REVENUE_STATUSES] }, '$items.quantity', 0],
              },
            },
            revenue: {
              $sum: {
                $cond: [{ $in: ['$status', REVENUE_STATUSES] }, '$items.total', 0],
              },
            },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),

      // Payment method breakdown
      Order.aggregate([
        { $match: rangeMatch },
        {
          $group: {
            _id: '$payment.method',
            orders: { $sum: 1 },
            revenue: {
              $sum: { $cond: [{ $in: ['$status', REVENUE_STATUSES] }, '$total', 0] },
            },
          },
        },
        { $sort: { revenue: -1 } },
      ]),

      // Top delivery cities (from shipping address)
      Order.aggregate([
        { $match: rangeMatch },
        {
          $group: {
            _id: '$shippingAddress.city',
            orders: { $sum: 1 },
            revenue: {
              $sum: { $cond: [{ $in: ['$status', REVENUE_STATUSES] }, '$total', 0] },
            },
          },
        },
        { $sort: { orders: -1 } },
        { $limit: 10 },
      ]),

      // Total refunded amount (approved/completed)
      Order.aggregate([
        { $match: rangeMatch },
        { $unwind: '$refunds' },
        { $match: { 'refunds.status': { $in: ['approved', 'completed'] } } },
        { $group: { _id: null, total: { $sum: '$refunds.amount' } } },
      ]),

      // Revenue minus cost-of-goods (for gross margin)
      Order.aggregate([
        { $match: revenueMatch },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', revenue: { $sum: '$items.total' }, units: { $sum: '$items.quantity' } } },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$revenue' },
            cost: {
              $sum: { $multiply: [{ $ifNull: ['$product.costPrice', 0] }, '$units'] },
            },
          },
        },
      ]),

      // Per-user order counts in period (repeat purchase rate, active customers)
      Order.aggregate([
        { $match: { ...rangeMatch, user: { $exists: true, $ne: null } } },
        { $group: { _id: '$user', orders: { $sum: 1 } } },
      ]),

      // Customers active before the period (retention/churn base).
      // Full-history scan → memoized per "from" date.
      slowMemo(`active-before:${from.toISOString().slice(0, 10)}`, () =>
        Order.aggregate([
          { $match: { user: { $exists: true, $ne: null }, createdAt: { $lt: from } } },
          { $group: { _id: '$user' } },
        ])
      ),

      // Visitor identities + per-type event counts in a single pass over
      // TrafficEvents (previously two separate scans of the same range).
      TrafficEvent.aggregate([
        { $match: rangeMatch },
        {
          $facet: {
            identities: [
              { $group: { _id: { u: '$userId', s: '$sessionId' } } },
            ],
            byType: [
              { $group: { _id: '$type', count: { $sum: 1 } } },
            ],
          },
        },
      ]),

      // Cart visitor identities for the funnel
      Cart.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: { u: '$user', s: '$sessionId' } } },
      ]),

      // Carts created in period (funnel fallback for add-to-cart)
      Cart.countDocuments({ createdAt: { $gte: from, $lte: to } }),

      // Order identities for funnel visitors
      Order.aggregate([
        { $match: rangeMatch },
        { $group: { _id: { u: '$user', g: '$guestEmail', ip: '$ipAddress' } } },
      ]),

      // New customer accounts per day (acquisition)
      User.aggregate([
        { $match: { role: 'user', createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // All-time revenue for CLV. Full-history scan → memoized.
      slowMemo('clv-revenue', () =>
        Order.aggregate([
          { $match: { status: { $in: REVENUE_STATUSES } } },
          { $group: { _id: null, revenue: { $sum: '$total' } } },
          {
            $project: {
              _id: 0,
              revenue: 1,
            },
          },
        ])
      ),

      // ── Hourly order pattern (peak shopping times) ────────────────────
      Order.aggregate([
        { $match: rangeMatch },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            orders: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $in: ['$status', REVENUE_STATUSES] },
                  { $ifNull: ['$total', 0] },
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // ── Weekday pattern (1 = Sunday … 7 = Saturday) ───────────────────
      Order.aggregate([
        { $match: rangeMatch },
        {
          $group: {
            _id: { $dayOfWeek: '$createdAt' },
            orders: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $in: ['$status', REVENUE_STATUSES] },
                  { $ifNull: ['$total', 0] },
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // ── Coupon / promo usage in period (by code) ──────────────────────
      Order.aggregate([
        { $match: { ...rangeMatch, couponCode: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: { $toUpper: '$couponCode' },
            orders: { $sum: 1 },
            discount: { $sum: { $ifNull: ['$couponDiscount', 0] } },
            revenue: {
              $sum: {
                $cond: [
                  { $in: ['$status', REVENUE_STATUSES] },
                  { $ifNull: ['$total', 0] },
                  0,
                ],
              },
            },
          },
        },
        { $sort: { orders: -1 } },
        { $limit: 6 },
      ]),

      // ── Refund requests: by status + by reason in a single pass ───────
      Order.aggregate([
        { $match: { 'refunds.status': { $exists: true } } },
        { $unwind: '$refunds' },
        {
          $facet: {
            byStatus: [
              {
                $group: {
                  _id: '$refunds.status',
                  count: { $sum: 1 },
                  amount: { $sum: '$refunds.amount' },
                },
              },
            ],
            byReason: [
              {
                $group: {
                  _id: { $ifNull: ['$refunds.reason', 'Not specified'] },
                  count: { $sum: 1 },
                  amount: { $sum: '$refunds.amount' },
                },
              },
              { $sort: { count: -1 } },
              { $limit: 6 },
            ],
          },
        },
      ]),

      // ── Top registered customers by spend in period ───────────────────
      Order.aggregate([
        { $match: { ...revenueMatch, user: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$user',
            orders: { $sum: 1 },
            spend: { $sum: { $ifNull: ['$total', 0] } },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            name: { $ifNull: ['$user.name', 'Registered customer'] },
            email: { $ifNull: ['$user.email', ''] },
            orders: 1,
            spend: 1,
          },
        },
        { $sort: { spend: -1 } },
        { $limit: 5 },
      ]),

      // ── Top guest customers by spend in period ────────────────────────
      Order.aggregate([
        { $match: { ...revenueMatch, guestEmail: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: '$guestEmail',
            orders: { $sum: 1 },
            spend: { $sum: { $ifNull: ['$total', 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            name: 'Guest',
            email: '$_id',
            orders: 1,
            spend: 1,
          },
        },
        { $sort: { spend: -1 } },
        { $limit: 5 },
      ]),

      // ── Order sources (website / mobile_app / admin / api) ────────────
      Order.aggregate([
        { $match: rangeMatch },
        {
          $group: {
            _id: { $ifNull: ['$source', 'unknown'] },
            orders: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $in: ['$status', REVENUE_STATUSES] },
                  { $ifNull: ['$total', 0] },
                  0,
                ],
              },
            },
          },
        },
        { $sort: { orders: -1 } },
      ]),
    ]);

    const daySeries = daySeriesFacet[0] || {};
    const revenueByDay = daySeries.revenue || [];
    const unitsByDay = daySeries.units || [];

    const traffic = trafficFacet[0] || {};
    const trafficSessions = traffic.identities || [];
    const eventCounts = traffic.byType || [];

    const refunds = refundsFacet[0] || {};
    const refundsByStatus = refunds.byStatus || [];
    const refundsByReason = refunds.byReason || [];

    // All-time distinct customers (users + guest emails) for CLV.
    // Full-history scan → memoized.
    const allTimeCustomers = await slowMemo('clv-customers', () =>
      Order.aggregate([
        { $match: { status: { $in: REVENUE_STATUSES } } },
        { $group: { _id: { u: '$user', g: '$guestEmail' } } },
      ])
    );

    const t = totals[0] || {};
    const orders = t.orders || 0;
    const revenue = t.revenue || 0;
    const refundedAmount = refundClaimed[0]?.total || 0;
    const cogs = cogsAgg[0]?.cost || 0;
    const grossProfit = revenue - cogs;

    // ── Product analytics ──────────────────────────────────────────────
    const productFields = 'name slug images viewCount salesCount wishlistCount';
    const [mostViewed, mostPurchased, mostWishlisted, performanceFacet] = await Promise.all([
      Product.find({ status: 'active' }).sort({ viewCount: -1 }).limit(5).select(productFields).lean(),
      Product.find({ status: 'active' }).sort({ salesCount: -1 }).limit(5).select(productFields).lean(),
      Product.find({ status: 'active' }).sort({ wishlistCount: -1 }).limit(5).select(productFields).lean(),
      // Low-performing + best-converting products computed in MongoDB instead
      // of loading every active product into memory and sorting in JS.
      Product.aggregate([
        { $match: { status: 'active', viewCount: { $gt: 0 } } },
        {
          $project: {
            name: 1,
            slug: 1,
            images: 1,
            viewCount: 1,
            salesCount: 1,
            wishlistCount: 1,
            ratio: { $divide: [{ $ifNull: ['$salesCount', 0] }, '$viewCount'] },
          },
        },
        {
          $facet: {
            low: [{ $sort: { ratio: 1 } }, { $limit: 5 }],
            high: [{ $sort: { ratio: -1 } }, { $limit: 5 }],
          },
        },
      ]),
    ]);
    const perf = performanceFacet[0] || {};
    const lowPerforming = perf.low || [];
    const topConversion = perf.high || [];

    const mapProduct = (p: any) => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      image: primaryImage(p),
      viewCount: p.viewCount || 0,
      salesCount: p.salesCount || 0,
      wishlistCount: p.wishlistCount || 0,
      conversionRate:
        (p.viewCount || 0) > 0
          ? round(((p.salesCount || 0) / (p.viewCount || 1)) * 100, 1)
          : 0,
    });

    // ── Customer analytics ─────────────────────────────────────────────
    const activeBefore = new Set(activeBeforeAgg.map((u: any) => String(u._id)));
    // Same query as userOrderCounts — reuse it instead of a second scan.
    const activeInPeriod = new Set(userOrderCounts.map((u: any) => String(u._id)));
    const retained = Array.from(activeInPeriod).filter((id) => activeBefore.has(id)).length;
    const retentionRate =
      activeBefore.size > 0 ? round((retained / activeBefore.size) * 100, 1) : null;
    const churnRate = retentionRate !== null ? round(100 - retentionRate, 1) : null;
    const repeatCustomers = userOrderCounts.filter((u: any) => u.orders >= 2).length;
    const repeatPurchaseRate =
      userOrderCounts.length > 0
        ? round((repeatCustomers / userOrderCounts.length) * 100, 1)
        : 0;
    const allTimeRevenue = clvAgg[0]?.revenue || 0;
    const clv =
      allTimeCustomers.length > 0
        ? round(allTimeRevenue / allTimeCustomers.length, 2)
        : 0;
    const acquired = acquisitionByDay.reduce((s: number, d: any) => s + (d.count || 0), 0);

    // ── Conversion funnel (visitors → … → order) ───────────────────────
    const visitorKeys = new Set<string>();
    trafficSessions.forEach((ev: any) => {
      if (ev._id?.u) visitorKeys.add(`u:${ev._id.u}`);
      if (ev._id?.s) visitorKeys.add(`s:${ev._id.s}`);
    });
    cartSessions.forEach((c: any) => {
      if (c._id?.u) visitorKeys.add(`u:${c._id.u}`);
      if (c._id?.s) visitorKeys.add(`s:${c._id.s}`);
    });
    orderSessions.forEach((o: any) => {
      if (o._id?.u) visitorKeys.add(`u:${o._id.u}`);
      if (o._id?.g) visitorKeys.add(`g:${o._id.g}`);
      if (o._id?.ip) visitorKeys.add(`ip:${o._id.ip}`);
    });
    const visitors = visitorKeys.size;
    const countOf = (type: string) =>
      eventCounts.find((e: any) => e._id === type)?.count || 0;

    const funnel = {
      visitors,
      productViews: countOf('product_view'),
      addToCart: Math.max(countOf('add_to_cart'), cartsCreated || 0),
      checkout: Math.max(countOf('checkout_start'), orders),
      payment: Math.max(0, orders - (t.payFailed || 0)),
      orders,
    };

    const [customers, products] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Product.countDocuments({}),
    ]);

    // ── New analytics sections ──────────────────────────────────────────
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hourlyOrders = Array.from({ length: 24 }, (_, hour) => {
      const found = hourlyAgg.find((h: any) => h._id === hour);
      return { hour, orders: found?.orders || 0, revenue: found?.revenue || 0 };
    });
    const weekdayOrders = weekdayAgg.map((d: any) => ({
      day: DAYS[(d._id || 1) - 1] || '?',
      orders: d.orders || 0,
      revenue: d.revenue || 0,
    }));
    const couponRevenue = couponAgg.reduce((sum: number, c: any) => sum + (c.revenue || 0), 0);
    const refundsTotal = refundsByStatus.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
    const refundsAmount = refundsByStatus.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    const topCustomers = [
      ...topRegisteredCustomers.map((c: any) => ({
        name: c.name || 'Registered customer',
        email: c.email || '',
        orders: c.orders || 0,
        spend: c.spend || 0,
      })),
      ...topGuestCustomers.map((c: any) => ({
        name: c.name || 'Guest',
        email: c.email || '',
        orders: c.orders || 0,
        spend: c.spend || 0,
      })),
    ]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);

    return NextResponse.json({
      range: { from, to, days },
      totals: {
        revenue,
        orders,
        units: t.units || 0,
        avgOrderValue: orders > 0 ? round(revenue / orders) : 0,
        grossMargin: revenue > 0 ? round((grossProfit / revenue) * 100, 1) : 0,
        netMargin: revenue > 0 ? round(((revenue - refundedAmount) / revenue) * 100, 1) : 0,
        refundRate: revenue > 0 ? round((refundedAmount / revenue) * 100, 1) : 0,
        customers,
        products,
        delivered: t.delivered || 0,
        cancelled: t.cancelled || 0,
        returned: t.returned || 0,
        refunded: t.refunded || 0,
        refundedAmount: round(refundedAmount),
        payFailed: t.payFailed || 0,
        totalDiscount: t.couponDiscount || 0,
        couponOrders: t.couponOrders || 0,
        discountRate:
          revenue + (t.couponDiscount || 0) > 0
            ? round(((t.couponDiscount || 0) / (revenue + (t.couponDiscount || 0))) * 100, 1)
            : 0,
        loyaltyEarned: t.loyaltyEarned || 0,
        loyaltyUsed: t.loyaltyUsed || 0,
      },
      revenueByDay,
      unitsByDay,
      salesByCategory,
      topProducts,
      paymentMethods: paymentMethods.map((pm: any) => ({
        method: pm._id || 'unknown',
        orders: pm.orders,
        revenue: pm.revenue,
      })),
      topCities: topCities.map((c: any) => ({
        city: c._id || 'Unknown',
        orders: c.orders,
        revenue: c.revenue,
      })),
      productAnalytics: {
        mostViewed: mostViewed.map(mapProduct),
        mostPurchased: mostPurchased.map(mapProduct),
        mostWishlisted: mostWishlisted.map(mapProduct),
        lowPerforming: lowPerforming.map(mapProduct),
        topConversion: topConversion.map(mapProduct),
      },
      customerAnalytics: {
        acquisition: acquired,
        acquisitionByDay,
        activeCustomers: userOrderCounts.length,
        retentionRate,
        churnRate,
        clv,
        repeatPurchaseRate,
      },
      funnel,
      hourlyOrders,
      weekdayOrders,
      promoStats: {
        couponOrders: t.couponOrders || 0,
        totalDiscount: round(t.couponDiscount || 0),
        couponRevenue: round(couponRevenue),
        discountRate:
          revenue + (t.couponDiscount || 0) > 0
            ? round(((t.couponDiscount || 0) / (revenue + (t.couponDiscount || 0))) * 100, 1)
            : 0,
        byCoupon: couponAgg.map((c: any) => ({
          code: c._id,
          orders: c.orders,
          discount: c.discount,
          revenue: c.revenue,
        })),
      },
      refundAnalytics: {
        totalCount: refundsTotal,
        totalAmount: round(refundsAmount),
        byStatus: refundsByStatus.map((r: any) => ({
          status: r._id,
          count: r.count,
          amount: round(r.amount),
        })),
        byReason: refundsByReason.map((r: any) => ({
          reason: r._id,
          count: r.count,
          amount: round(r.amount),
        })),
      },
      topCustomers,
      orderSources: orderSourcesAgg.map((s2: any) => ({
        source: s2._id,
        orders: s2.orders || 0,
        revenue: s2.revenue || 0,
      })),
      loyalty: {
        pointsEarned: t.loyaltyEarned || 0,
        pointsUsed: t.loyaltyUsed || 0,
      },
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load analytics' },
      { status: 500 }
    );
  }
}