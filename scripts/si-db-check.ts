/* eslint-disable no-console */
// DB-level check: runs the exact aggregations the store-intelligence route performs
// against the live MongoDB and feeds them through the pure engine. Read-only.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import mongoose from 'mongoose';
import Order from '../models/Order';
import Product from '../models/Product';
import TrafficEvent from '../models/TrafficEvent';
import {
  forecastRevenue,
  computeCohortIntelligence,
  computeTrafficIntelligence,
  computeProductAttention,
  generateStoreInsights,
  type CohortRow,
  type TrafficEventLite,
} from '../lib/ai/storeIntelligence';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pakistaninoor';
  await mongoose.connect(uri);
  console.log('connected');

  const now = new Date();
  const days = 90;
  const from = new Date(now.getTime() - days * 86400000);
  from.setHours(0, 0, 0, 0);
  const priorFrom = new Date(from.getTime() - days * 86400000);
  const forecastFrom = new Date(now.getTime() - 90 * 86400000);
  forecastFrom.setHours(0, 0, 0, 0);

  const REVENUE_STATUSES = ['confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

  const [dailyRevenueAgg, periodTotals, cohortOrders, trafficEvents, windowViews, priorViews] =
    await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: forecastFrom }, status: { $in: REVENUE_STATUSES } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: from, $lte: now }, status: { $in: REVENUE_STATUSES } } },
        { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(now.getTime() - 24 * 30 * 86400000) },
            status: { $nin: ['cancelled', 'refunded', 'returned'] },
          },
        },
        { $project: { user: 1, guestEmail: 1, total: 1, createdAt: 1 } },
        { $sort: { createdAt: 1 } },
        { $limit: 5000 },
      ]),
      TrafficEvent.find({
        createdAt: { $gte: from, $lte: now },
        $or: [{ sessionId: { $exists: true, $ne: null } }, { userId: { $exists: true, $ne: null } }],
      })
        .select('type sessionId userId productId categoryId path source createdAt')
        .sort({ createdAt: -1 })
        .limit(4000)
        .lean(),
      TrafficEvent.aggregate([
        { $match: { type: 'product_view', createdAt: { $gte: from, $lte: now } } },
        { $group: { _id: '$productId', count: { $sum: 1 }, categoryId: { $first: '$categoryId' } } },
      ]),
      TrafficEvent.aggregate([
        { $match: { type: 'product_view', createdAt: { $gte: priorFrom, $lt: from } } },
        { $group: { _id: '$productId', count: { $sum: 1 } } },
      ]),
    ]);

  console.log('daily revenue points:', dailyRevenueAgg.length, 'last:', JSON.stringify(dailyRevenueAgg[dailyRevenueAgg.length - 1]));
  const forecast = forecastRevenue(dailyRevenueAgg.map((d: any) => ({ date: d._id, revenue: d.revenue || 0 })), 14);
  console.log('forecast:', JSON.stringify(forecast.summary));

  const cohortRows: CohortRow[] = (cohortOrders as any[])
    .map((o: any) => {
      const identity = o.user ? String(o.user) : o.guestEmail ? `guest:${String(o.guestEmail).toLowerCase()}` : '';
      if (!identity) return null;
      return { identity, createdAt: new Date(o.createdAt), total: Number(o.total) || 0 };
    })
    .filter(Boolean) as CohortRow[];
  console.log('cohort rows:', cohortRows.length);
  const cohorts = computeCohortIntelligence(cohortRows, 8);
  console.log('cohorts:', cohorts.cohorts.map((c) => `${c.label}(size ${c.size})`).join(', '), '| m1:', cohorts.m1Retention);

  const trafficInput: TrafficEventLite[] = (trafficEvents as any[]).map((ev: any) => ({
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
  console.log('traffic:', JSON.stringify({
    events: traffic.trafficEvents,
    sessions: traffic.totalSessions,
    converted: traffic.convertedSessions,
    convPct: traffic.conversionPct,
    hourTop: traffic.hourly.sort((a, b) => b.events - a.events)[0],
    landings: traffic.topLandingPaths.slice(0, 3),
  }));

  const ids = new Set([...(windowViews as any[]).map((v: any) => String(v._id)), ...(priorViews as any[]).map((v: any) => String(v._id))]);
  const products = ids.size ? await Product.find({ _id: { $in: [...ids] } }).select('name slug price images salesCount').lean() : [];
  const meta = new Map(
    products.map((p: any) => [
      String(p._id),
      { name: p.name, slug: p.slug, price: p.price, image: p.images?.find((i: any) => i.isPrimary)?.url || p.images?.[0]?.url || '', salesCount: p.salesCount || 0 },
    ])
  );
  const attention = computeProductAttention(
    (windowViews as any[]).map((v: any) => ({ productId: String(v._id), count: v.count })),
    (priorViews as any[]).map((v: any) => ({ productId: String(v._id), count: v.count })),
    meta
  );
  console.log('attention:', attention.slice(0, 3).map((a) => `${a.name} v=${a.windowViews} d=${a.deltaPct}%`).join(' | '));

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
  console.log('insights:');
  for (const i of insights) console.log(`  [${i.severity}] ${i.title}`);

  await mongoose.disconnect();
  console.log('done');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});