// Quick sanity test for the Store Intelligence pure engine (run with ts-node).
import {
  forecastRevenue,
  computeCohortIntelligence,
  computeTrafficIntelligence,
  computeProductAttention,
  generateStoreInsights,
  type CohortRow,
  type TrafficEventLite,
} from '../lib/ai/storeIntelligence';

const now = new Date('2026-09-20T12:00:00.000Z');

// ---- Forecast: 60 days of ~5000/day with upward drift + weekend dip + noise ----
const daily = [];
for (let i = 59; i >= 0; i--) {
  const d = new Date(now.getTime() - i * 86400000);
  const dow = d.getUTCDay();
  const weekend = dow === 5 || dow === 6 ? 0.7 : 1;
  const drift = 1 + (59 - i) * 8; // growing trend
  const noise = Math.sin(i * 3) * 300;
  daily.push({
    date: d.toISOString().slice(0, 10),
    revenue: Math.max(100, Math.round((4800 + drift + noise) * weekend)),
  });
}
const f = forecastRevenue(daily, 14);
console.log('FORECAST summary:', f.summary);
console.log('FORECAST points:', f.points.length, 'first fut:', f.points.find((p) => p.index === 1));
console.log('  band sane:', f.points.filter((p) => p.index > 0).every((p) => p.low! <= p.forecast! && p.forecast! <= p.high!));

// ---- Cohorts ----
const mk = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const rows: CohortRow[] = [];
const add = (id: string, dates: Array<{ y: number; m: number; d: number; total: number }>) => {
  for (const dt of dates) {
    rows.push({ identity: id, createdAt: mk(dt.y, dt.m, dt.d), total: dt.total });
  }
};
// Cohort Apr 2026: 10 customers, 4 return in May, 2 in Jun
for (let i = 0; i < 10; i++) {
  add(`u-apr-${i}`, [{ y: 2026, m: 4, d: 5 + i, total: 2000 }]);
  if (i < 4) add(`u-apr-${i}`, [{ y: 2026, m: 5, d: 10, total: 1500 }]);
  if (i < 2) add(`u-apr-${i}`, [{ y: 2026, m: 6, d: 12, total: 1800 }]);
}
// Cohort May 2026: 15 customers, 12 return in Jun
for (let i = 0; i < 15; i++) {
  add(`u-may-${i}`, [{ y: 2026, m: 5, d: 12 + i, total: 1200 }]);
  if (i < 12) add(`u-may-${i}`, [{ y: 2026, m: 6, d: 20, total: 900 }]);
}
const c = computeCohortIntelligence(rows, 8);
for (const coh of c.cohorts) {
  console.log('COHORT', coh.label, 'size', coh.size, 'rev', coh.revenue, coh.months.map((m) => `${m.monthIndex}:${m.retentionPct}%`).join(' '));
}
console.log('M1 retention:', c.m1Retention);

// ---- Traffic ----
const evts: TrafficEventLite[] = [];
const evt = (sess: string, type: string, path: string, minutesAgo: number) =>
  evts.push({ type, sessionId: sess, path, createdAt: new Date(now.getTime() - minutesAgo * 60000) });
// 3 sessions, 1 converts after 4 steps
evt('s1', 'page_view', '/', 30); evt('s1', 'product_view', '/product/a', 28); evt('s1', 'add_to_cart', '/product/a', 20); evt('s1', 'order_placed', '/checkout/success', 5);
evt('s2', 'page_view', '/', 25); evt('s2', 'product_view', '/product/b', 22); evt('s2', 'checkout_start', '/checkout', 10);
evt('s3', 'product_view', '/product/a', 15);
// 10 guest checkouts for conversion stats
const t = computeTrafficIntelligence(evts);
console.log('TRAFFIC sessions:', t.totalSessions, 'converted:', t.convertedSessions, 'conv%', t.conversionPct, 'avgSteps', t.avgStepsToConversion);
console.log('  landings:', JSON.stringify(t.topLandingPaths));

// ---- Attention ----
const meta = new Map([
  ['p1', { name: 'Kurta', slug: 'kurta', price: 1200, salesCount: 30 }],
  ['p2', { name: 'Dupatta', slug: 'dupatta', price: 800, salesCount: 1 }],
  ['p3', { name: 'Shoes', slug: 'shoes', price: 2500, salesCount: 5 }],
]);
const att = computeProductAttention(
  [
    { productId: 'p1', count: 25 },
    { productId: 'p2', count: 40 },
    { productId: 'p3', count: 8 },
  ],
  [
    { productId: 'p1', count: 30 },
    { productId: 'p2', count: 5 },
  ],
  meta
);
console.log('ATTENTION:', att.map((a) => `${a.name} v=${a.windowViews} d=${a.deltaPct}% rising=${a.rising} snb=${a.seenNotBought}`).join(' | '));

// ---- Insights ----
const insights = generateStoreInsights({
  forecast: f,
  cohorts: c,
  traffic: t,
  attention: att,
  periodDays: 30,
  ordersInPeriod: 12,
  revenueInPeriod: 40000,
});
console.log('INSIGHTS:');
for (const ins of insights) console.log(`  [${ins.severity}] ${ins.title}`);