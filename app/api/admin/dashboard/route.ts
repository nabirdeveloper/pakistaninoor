import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import User from '@/models/User';
import Cart from '@/models/Cart';
import Review from '@/models/Review';
import SupportTicket from '@/models/SupportTicket';
import TrafficEvent from '@/models/TrafficEvent';

// Statuses that count toward sales revenue.
const REVENUE_STATUSES = [
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
];

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

// Shape of aggregated visitor/session identity keys (user / guest / ip).
type SessionIdentity = {
  _id?: { u?: string | null; s?: string | null; g?: string | null; ip?: string | null };
};

/**
 * GET /api/admin/dashboard
 *   ?days=30            range preset (7|30|90|365)
 *   &start=YYYY-MM-DD   custom range (optional, must pair with &end)
 *   &end=YYYY-MM-DD     custom range (optional)
 *
 * Returns everything the /admin dashboard renders:
 *  - overview: 15 headline KPIs (period-scoped except inventory state)
 *  - live: real-time widgets (rolling 24h / today / last 30 min windows)
 *  - charts: revenue, sales, orders, customers, products, categories,
 *            traffic, conversion funnel, geography, payment methods
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const daysParam = parseInt(searchParams.get('days') || '30') || 30;
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const to = endParam ? new Date(`${endParam}T23:59:59.999`) : new Date();
    let from: Date;
    let days = daysParam;

    if (startParam && endParam) {
      from = new Date(`${startParam}T00:00:00.000`);
      days = Math.max(
        1,
        Math.round((to.getTime() - from.getTime()) / 86400000)
      );
    } else {
      days = Math.min(365, Math.max(1, daysParam));
      from = new Date(to.getTime() - days * 86400000);
      from.setHours(0, 0, 0, 0);
    }

    const liveFrom = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeFrom = new Date(Date.now() - 30 * 60 * 1000);
    const checkoutFrom = new Date(Date.now() - 60 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const rangeMatch = { createdAt: { $gte: from, $lte: to } };
    const revenueMatch = {
      createdAt: { $gte: from, $lte: to },
      status: { $in: REVENUE_STATUSES },
    };

    // Previous period of equal length — used for KPI delta badges and the
    // revenue "vs previous period" overlay on the dashboard.
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(from.getTime() - days * 86400000);
    const prevRangeMatch = { createdAt: { $gte: prevFrom, $lte: prevTo } };
    const prevRevenueMatch = {
      createdAt: { $gte: prevFrom, $lte: prevTo },
      status: { $in: REVENUE_STATUSES },
    };

    const [
      orderStats,
      revenueDay,
      unitsDay,
      orderDay,
      customerDay,
      refundAgg,
      productCount,
      lowStockCount,
      outOfStockCount,
      newUsers,
      userOrderCounts,
      trafficSessions,
      cartSessions,
      orderSessions,
      cogsAgg,
      topProducts,
      categoryPerformance,
      trafficEvents,
      geoAgg,
      paymentAgg,
      statusAgg,
      liveOrders24h,
      todayRevenueAgg,
      activeTrafficSessions,
      activeCartSessions,
      activeUsers,
      activeCarts,
      recentOrders,
      recentUsers,
      recentReviews,
      recentTickets,
      openTickets,
      paymentAlertsAgg,
      fraudAlertsAgg,
      inventoryAlerts,
      cartCountNew,
      inventoryValueAgg,
      categoryInventoryAgg,
      couponAgg,
      hourlyAgg,
      topRegisteredCustomers,
      topGuestCustomers,
      deliveryTimeAgg,
      refundQueueAgg,
      refundReasonsAgg,
      // ── Comparison with the previous period ─────────────────────────
      prevOrderStats,
      prevNewUsers,
      prevTrafficSessions,
      prevCartSessions,
      prevOrderSessions,
      prevRevenueDay,
      weekdayHourAgg,
    ] = await Promise.all([
      // Period order/revenue/cancelled/pending rollup
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
                  { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } },
                  0,
                ],
              },
            },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            returned: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] } },
            refunded: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            couponDiscount: { $sum: { $ifNull: ['$couponDiscount', 0] } },
            couponOrders: {
              $sum: { $cond: [{ $ifNull: ['$couponCode', false] }, 1, 0] },
            },
          },
        },
      ]),

      // Revenue by day
      Order.aggregate([
        { $match: revenueMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Units sold by day (sales analytics)
      Order.aggregate([
        { $match: revenueMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            units: { $sum: '$items.quantity' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Orders by day (order analytics)
      Order.aggregate([
        { $match: rangeMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Customer growth by day
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

      // Refund amount in period (approved/completed)
      Order.aggregate([
        { $match: rangeMatch },
        { $unwind: '$refunds' },
        { $match: { 'refunds.status': { $in: ['approved', 'completed'] } } },
        { $group: { _id: null, total: { $sum: '$refunds.amount' } } },
      ]),

      // Inventory state
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ status: 'active', trackInventory: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
      Product.countDocuments({ status: 'active', trackInventory: true, stock: 0 }),
      // New customers (created in period)
      User.countDocuments({ role: 'user', createdAt: { $gte: from, $lte: to } }),
      // Per-user order counts in period (returning customer rate)
      Order.aggregate([
        { $match: { ...rangeMatch, user: { $exists: true, $ne: null } } },
        { $group: { _id: '$user', orders: { $sum: 1 } } },
      ]),

      // Visitor identity sets
      TrafficEvent.aggregate([
        { $match: rangeMatch },
        { $group: { _id: { u: '$userId', s: '$sessionId' } } },
      ]),
      Cart.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: { u: '$user', s: '$sessionId' } } },
      ]),
      Order.aggregate([
        { $match: rangeMatch },
        { $group: { _id: { u: '$user', g: '$guestEmail', ip: '$ipAddress' } } },
      ]),

      // Revenue minus cost-of-goods (for gross profit)
      Order.aggregate([
        { $match: revenueMatch },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', revenue: { $sum: '$items.total' }, units: { $sum: '$items.quantity' } } },
        {
          $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$revenue' },
            cost: {
              $sum: {
                $multiply: [{ $ifNull: ['$product.costPrice', 0] }, '$units'],
              },
            },
          },
        },
      ]),

      // Top products by revenue
      Order.aggregate([
        { $match: revenueMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            name: { $first: '$items.name' },
            slug: { $first: '$items.slug' },
            image: { $first: '$items.image' },
            units: { $sum: '$items.quantity' },
            revenue: { $sum: '$items.total' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 8 },
      ]),

      // Category performance
      Order.aggregate([
        { $match: revenueMatch },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', revenue: { $sum: '$items.total' }, units: { $sum: '$items.quantity' } } },
        {
          $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$product.category', revenue: { $sum: '$revenue' }, units: { $sum: '$units' } } },
        {
          $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' },
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
        { $limit: 8 },
      ]),

      // Traffic events by day (page/product views, cart adds, orders)
      TrafficEvent.aggregate([
        { $match: rangeMatch },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              type: '$type',
            },
            count: { $sum: 1 },
          },
        },
      ]),

      // Geographic sales (top delivery cities)
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
        { $limit: 8 },
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

      // Orders by status (for the overview strip)
      Order.aggregate([
        { $match: rangeMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // ── Live widgets ────────────────────────────────────────────────
      Order.countDocuments({ createdAt: { $gte: liveFrom } }),
      Order.aggregate([
        { $match: { createdAt: { $gte: todayStart }, status: { $in: REVENUE_STATUSES } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      TrafficEvent.aggregate([{ $match: { createdAt: { $gte: activeFrom } } }, { $group: { _id: { u: '$userId', s: '$sessionId' } } }]),
      Cart.aggregate([{ $match: { lastActivity: { $gte: activeFrom } } }, { $group: { _id: { u: '$user', s: '$sessionId' } } }]),
      User.countDocuments({ lastLogin: { $gte: activeFrom } }),
      Cart.countDocuments({ lastActivity: { $gte: checkoutFrom }, items: { $ne: [] } }),

      Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(6).lean(),
      User.find({ role: 'user' }).sort({ createdAt: -1 }).limit(5).select('name email createdAt').lean(),
      Review.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name')
        .populate('product', 'name')
        .select('rating status title createdAt')
        .lean(),
      SupportTicket.find().sort({ createdAt: -1 }).limit(5).select('ticketNumber subject priority status createdAt').lean(),
      SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress', 'waiting_customer'] } }),
      // Payment alerts — failed transactions
      Order.find({ 'payment.status': 'failed' }).sort({ createdAt: -1 }).limit(5).select('orderNumber total createdAt payment shippingAddress').lean(),
      // Fraud alerts — medium/high risk orders
      Order.find({ 'fraudRisk.level': { $in: ['medium', 'high'] } }).sort({ 'fraudRisk.analyzedAt': -1 }).limit(5).select('orderNumber total createdAt payment fraudRisk shippingAddress').lean(),
      // Inventory alerts
      Product.find({ status: 'active', trackInventory: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } })
        .sort({ stock: 1 })
        .limit(8)
        .select('name slug images stock lowStockThreshold')
        .lean(),
      // Carts created in period (funnel fallback for add-to-cart)
      Cart.countDocuments({ createdAt: { $gte: from, $lte: to } }),

      // ── Inventory value (active, tracked products) ────────────────────
      Product.aggregate([
        { $match: { status: 'active', trackInventory: true } },
        {
          $group: {
            _id: null,
            units: { $sum: '$stock' },
            costValue: {
              $sum: { $multiply: ['$stock', { $ifNull: ['$costPrice', 0] }] },
            },
            retailValue: {
              $sum: { $multiply: ['$stock', { $ifNull: ['$price', 0] }] },
            },
            potentialProfit: {
              $sum: {
                $multiply: [
                  '$stock',
                  { $subtract: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$costPrice', 0] }] },
                ],
              },
            },
          },
        },
      ]),

      // Inventory value by category (retail)
      Product.aggregate([
        { $match: { status: 'active', trackInventory: true } },
        {
          $group: {
            _id: '$category',
            units: { $sum: '$stock' },
            retailValue: {
              $sum: { $multiply: ['$stock', { $ifNull: ['$price', 0] }] },
            },
          },
        },
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
            units: 1,
            retailValue: 1,
          },
        },
        { $sort: { retailValue: -1 } },
        { $limit: 6 },
      ]),

      // Coupon / promo usage in period (by code)
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

      // Orders by hour of day (peak shopping times)
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

      // Top registered customers by spend in period
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

      // Top guest customers by spend in period
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

      // Average fulfillment time (placed → delivered) from order timelines
      Order.aggregate([
        { $match: { status: 'delivered' } },
        { $unwind: '$timeline' },
        { $match: { 'timeline.status': 'delivered' } },
        {
          $project: {
            hours: {
              $divide: [
                { $subtract: ['$timeline.timestamp', '$createdAt'] },
                3600000,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgHours: { $avg: '$hours' },
          },
        },
      ]),

      // Pending refund queue (count + amount)
      Order.aggregate([
        { $match: { 'refunds.0': { $exists: true } } },
        { $unwind: '$refunds' },
        { $match: { 'refunds.status': 'pending' } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: '$refunds.amount' },
          },
        },
      ]),

      // Pending refunds by reason
      Order.aggregate([
        { $match: { 'refunds.0': { $exists: true } } },
        { $unwind: '$refunds' },
        { $match: { 'refunds.status': 'pending' } },
        {
          $group: {
            _id: '$refunds.reason',
            count: { $sum: 1 },
            amount: { $sum: '$refunds.amount' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 4 },
      ]),

      // ── Previous period: order/revenue/units rollup ─────────────────
      Order.aggregate([
        { $match: prevRangeMatch },
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
                  { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } },
                  0,
                ],
              },
            },
          },
        },
      ]),

      // Previous period new customers
      User.countDocuments({ role: 'user', createdAt: { $gte: prevFrom, $lte: prevTo } }),

      // Previous period visitor identity sets (traffic / carts / orders)
      TrafficEvent.aggregate([
        { $match: prevRangeMatch },
        { $group: { _id: { u: '$userId', s: '$sessionId' } } },
      ]),
      Cart.aggregate([
        { $match: { createdAt: { $gte: prevFrom, $lte: prevTo } } },
        { $group: { _id: { u: '$user', s: '$sessionId' } } },
      ]),
      Order.aggregate([
        { $match: prevRangeMatch },
        { $group: { _id: { u: '$user', g: '$guestEmail', ip: '$ipAddress' } } },
      ]),

      // Previous period daily revenue (for the "vs previous period" chart overlay)
      Order.aggregate([
        { $match: prevRevenueMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Orders & revenue by weekday × hour (weekly activity heatmap)
      Order.aggregate([
        { $match: rangeMatch },
        {
          $group: {
            _id: {
              weekday: { $dayOfWeek: '$createdAt' },
              hour: { $hour: '$createdAt' },
            },
            orders: { $sum: 1 },
            revenue: {
              $sum: { $cond: [{ $in: ['$status', REVENUE_STATUSES] }, '$total', 0] },
            },
          },
        },
      ]),
    ]);

    const s = orderStats[0] || {};
    const orders = s.orders || 0;
    const revenue = s.revenue || 0;
    const refundAmount = refundAgg[0]?.total || 0;
    const cogs = cogsAgg[0]?.cost || 0;
    const netRevenue = Math.max(0, revenue - refundAmount);
    const grossProfit = revenue - cogs;
    const averageOrderValue = orders > 0 ? revenue / orders : 0;
    const todayRevenue = todayRevenueAgg[0]?.total || 0;

    // Physical visitors in period = union of traffic sessions, cart sessions,
    // order identities (user / guest email / ip address).
    const visitorKeys = new Set<string>();
    trafficSessions.forEach((t: any) => {
      if (t._id?.u) visitorKeys.add(`u:${t._id.u}`);
      if (t._id?.s) visitorKeys.add(`s:${t._id.s}`);
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

    // Previous-period visitor identity sets (same union logic as above)
    const prevVisitorKeys = new Set<string>();
    prevTrafficSessions.forEach((t: SessionIdentity) => {
      if (t._id?.u) prevVisitorKeys.add(`u:${t._id.u}`);
      if (t._id?.s) prevVisitorKeys.add(`s:${t._id.s}`);
    });
    prevCartSessions.forEach((c: SessionIdentity) => {
      if (c._id?.u) prevVisitorKeys.add(`u:${c._id.u}`);
      if (c._id?.s) prevVisitorKeys.add(`s:${c._id.s}`);
    });
    prevOrderSessions.forEach((o: SessionIdentity) => {
      if (o._id?.u) prevVisitorKeys.add(`u:${o._id.u}`);
      if (o._id?.g) prevVisitorKeys.add(`g:${o._id.g}`);
      if (o._id?.ip) prevVisitorKeys.add(`ip:${o._id.ip}`);
    });
    const prevVisitors = prevVisitorKeys.size;

    // Live visitors = active sessions in the last 30 minutes
    const liveVisitorKeys = new Set<string>();
    activeTrafficSessions.forEach((t: any) => {
      if (t._id?.u) liveVisitorKeys.add(`u:${t._id.u}`);
      if (t._id?.s) liveVisitorKeys.add(`s:${t._id.s}`);
    });
    activeCartSessions.forEach((c: any) => {
      if (c._id?.u) liveVisitorKeys.add(`u:${c._id.u}`);
      if (c._id?.s) liveVisitorKeys.add(`s:${c._id.s}`);
    });
    const liveVisitors = liveVisitorKeys.size + (activeUsers || 0);

    // Returning customer rate
    const customersWithOrders = userOrderCounts.length;
    const returningCustomers = userOrderCounts.filter(
      (u: any) => u.orders >= 2
    ).length;
    const returningCustomerRate =
      customersWithOrders > 0
        ? Math.round((returningCustomers / customersWithOrders) * 1000) / 10
        : 0;

    // Conversion rate (period)
    const conversionRate =
      visitors > 0 ? Math.round((orders / visitors) * 1000) / 10 : 0;

    // Reshape traffic events → daily { views, carts, orders }
    const trafficDayMap = new Map<string, { _id: string; views: number; carts: number; orders: number }>();
    trafficEvents.forEach((e: any) => {
      const key = String(e._id?.date || '');
      const entry = trafficDayMap.get(key) || { _id: key, views: 0, carts: 0, orders: 0 };
      const count = e.count || 0;
      if (e._id?.type === 'page_view' || e._id?.type === 'product_view') entry.views += count;
      else if (e._id?.type === 'add_to_cart') entry.carts += count;
      else if (e._id?.type === 'order_placed') entry.orders += count;
      trafficDayMap.set(key, entry);
    });
    const trafficByDay = Array.from(trafficDayMap.values()).sort((a, b) =>
      a._id.localeCompare(b._id)
    );

    // Traffic sources (acquisition channels)
    const trafficSourceAgg = await TrafficEvent.aggregate([
      { $match: rangeMatch },
      {
        $group: {
          _id: { $ifNull: ['$source', 'direct'] },
          views: { $sum: 1 },
        },
      },
      { $sort: { views: -1 } },
      { $limit: 6 },
    ]);

    // Conversion funnel (with cart-count fallbacks for stores that predate
    // traffic-event logging so seeded data still renders a meaningful funnel).
    const eventCounts = await TrafficEvent.aggregate([
      { $match: rangeMatch },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    const countOf = (type: string) =>
      eventCounts.find((e: any) => e._id === type)?.count || 0;
    const funnel = {
      visitors,
      productViews: countOf('product_view'),
      addToCart: Math.max(countOf('add_to_cart'), cartCountNew || 0),
      checkout: Math.max(countOf('checkout_start'), orders),
      orders,
      delivered: s.delivered || 0,
    };

    // Recent activities feed (unified stream)
    const activities: any[] = [];
    recentOrders.forEach((o: any) =>
      activities.push({
        key: `order-${o._id}`,
        type: 'order',
        title: `Order ${o.orderNumber}`,
        detail: `${o.user?.name || 'Guest'} · ${o.total.toLocaleString()} BDT · ${o.status}`,
        time: o.createdAt,
        href: `/admin/orders/${o.orderNumber}`,
      })
    );
    recentUsers.forEach((u: any) =>
      activities.push({
        key: `user-${u._id}`,
        type: 'customer',
        title: 'New customer',
        detail: `${u.name} <${u.email}>`,
        time: u.createdAt,
        href: '/admin/customers',
      })
    );
    recentReviews.forEach((r: any) =>
      activities.push({
        key: `review-${r._id}`,
        type: 'review',
        title: `${r.user?.name || 'Someone'} reviewed ${r.product?.name || 'a product'}`,
        detail: `${'★'.repeat(r.rating || 0)} · ${r.status || 'pending'} · "${r.title || 'no title'}"`,
        time: r.createdAt,
        href: '/admin/reviews',
      })
    );
    recentTickets.forEach((t: any) =>
      activities.push({
        key: `ticket-${t._id}`,
        type: 'ticket',
        title: `Ticket ${t.ticketNumber}`,
        detail: `${t.subject} · ${t.priority}`,
        time: t.createdAt,
        href: '/admin/support-triage',
      })
    );
    activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    const recentActivities = activities.slice(0, 10);

    const statusMap: Record<string, number> = {};
    statusAgg.forEach((item: { _id: string; count: number }) => {
      statusMap[item._id] = item.count;
    });

    // ── New single-vendor analytics sections ────────────────────────────
    const inv = inventoryValueAgg[0] || {};
    const couponRevenue = couponAgg.reduce((sum: number, c: any) => sum + (c.revenue || 0), 0);
    const pendingRefundQueue = refundQueueAgg[0] || {};
    const deliveryTime = deliveryTimeAgg[0] || {};

    // 24-slot hourly series (orders + revenue per hour of day)
    const hourly = Array.from({ length: 24 }, (_, hour) => {
      const found = hourlyAgg.find((h: any) => h._id === hour);
      return { hour, orders: found?.orders || 0, revenue: found?.revenue || 0 };
    });

    // Merge registered + guest customers, keep the top spenders overall
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
      .slice(0, 5);

    return NextResponse.json({
      range: { from, to, days },
      overview: {
        totalSales: s.units || 0,
        totalOrders: orders,
        totalCustomers: customersWithOrders,
        totalProducts: productCount,
        totalRevenue: revenue,
        netRevenue,
        grossProfit,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        conversionRate,
        returningCustomerRate,
        refundAmount,
        cancelledOrders: s.cancelled || 0,
        pendingOrders: s.pending || 0,
        lowStockProducts: lowStockCount,
        outOfStockProducts: outOfStockCount,
        inventoryValue: inv.retailValue || 0,
        inventoryCost: inv.costValue || 0,
        inventoryUnits: inv.units || 0,
        couponSavings: s.couponDiscount || 0,
        couponOrders: s.couponOrders || 0,
        pendingRefunds: pendingRefundQueue.count || 0,
        pendingRefundAmount: pendingRefundQueue.amount || 0,
      },
      live: {
        liveOrders: liveOrders24h,
        liveVisitors,
        liveCheckout: activeCarts,
        liveRevenue: todayRevenue,
        recentActivities,
        recentOrders,
        newCustomers: { count: newUsers, recent: recentUsers },
        supportTickets: { open: openTickets, recent: recentTickets },
        paymentAlerts: {
          count: paymentAlertsAgg.length,
          recent: paymentAlertsAgg.map((p: any) => ({
            _id: p._id,
            orderNumber: p.orderNumber,
            total: p.total,
            method: p.payment?.method,
            city: p.shippingAddress?.city,
            createdAt: p.createdAt,
          })),
        },
        fraudAlerts: {
          count: fraudAlertsAgg.length,
          recent: fraudAlertsAgg.map((f: any) => ({
            _id: f._id,
            orderNumber: f.orderNumber,
            total: f.total,
            level: f.fraudRisk?.level,
            score: f.fraudRisk?.score,
            action: f.fraudRisk?.recommendedAction,
            city: f.shippingAddress?.city,
            analyzedAt: f.fraudRisk?.analyzedAt,
          })),
        },
        inventoryAlerts: inventoryAlerts.map((p: any) => ({
          _id: p._id,
          name: p.name,
          slug: p.slug,
          image: p.images?.[0]?.url,
          stock: p.stock,
          threshold: p.lowStockThreshold,
        })),
      },
      charts: {
        revenue: revenueDay,
        sales: unitsDay,
        orders: orderDay,
        customerGrowth: customerDay,
        productPerformance: topProducts,
        categoryPerformance,
        traffic: trafficByDay,
        trafficSources: trafficSourceAgg.map((t: any) => ({
          source: t._id,
          views: t.views,
        })),
        funnel,
        geography: geoAgg.map((g: any) => ({
          city: g._id || 'Unknown',
          orders: g.orders,
          revenue: g.revenue,
        })),
        paymentMethods: paymentAgg.map((pm: any) => ({
          method: pm._id || 'unknown',
          orders: pm.orders,
          revenue: pm.revenue,
        })),
        prevRevenue: prevRevenueDay,
      },
      ordersByStatus: statusMap,
      comparison: {
        prevOrders: prevOrderStats[0]?.orders || 0,
        prevRevenue: Math.round((prevOrderStats[0]?.revenue || 0) * 100) / 100,
        prevUnits: prevOrderStats[0]?.units || 0,
        prevCustomers: prevNewUsers,
        prevVisitors,
      },
      heatmap: weekdayHourAgg.map((h: { _id: { weekday: number; hour: number }; orders?: number; revenue?: number }) => ({
        weekday: h._id.weekday,
        hour: h._id.hour,
        orders: h.orders || 0,
        revenue: h.revenue || 0,
      })),
      inventory: {
        units: inv.units || 0,
        costValue: inv.costValue || 0,
        retailValue: inv.retailValue || 0,
        potentialProfit: inv.potentialProfit || 0,
        byCategory: categoryInventoryAgg.map((c: any) => ({
          name: c.name,
          units: c.units,
          retailValue: c.retailValue,
        })),
      },
      promos: {
        couponOrders: s.couponOrders || 0,
        totalDiscount: s.couponDiscount || 0,
        couponRevenue,
        byCoupon: couponAgg.map((c: any) => ({
          code: c._id,
          orders: c.orders,
          discount: c.discount,
          revenue: c.revenue,
        })),
      },
      hourly,
      topCustomers,
      delivery: {
        avgHours: Math.round((deliveryTime.avgHours || 0) * 10) / 10,
        deliveredCount: deliveryTime.count || 0,
        inTransit: (statusMap.shipped || 0) + (statusMap.out_for_delivery || 0),
        toFulfill:
          (statusMap.pending || 0) +
          (statusMap.confirmed || 0) +
          (statusMap.processing || 0) +
          (statusMap.packed || 0),
      },
      refunds: {
        pending: {
          count: pendingRefundQueue.count || 0,
          amount: pendingRefundQueue.amount || 0,
        },
        byReason: refundReasonsAgg.map((r: any) => ({
          reason: r._id,
          count: r.count,
          amount: r.amount,
        })),
      },
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}