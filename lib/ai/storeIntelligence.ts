/**
 * Store Intelligence (Phase 8)
 * ============================
 * Predictive + behavioural layer on top of the analytics suite:
 *
 *   1. Revenue forecasting — linear-trend + day-of-week seasonality model
 *      with a 95% confidence band, projected daily for the next horizon.
 *   2. Cohort retention — new-customer cohorts by first-order month with
 *      month-over-month retention rates (active-in-month basis).
 *   3. Traffic & path intelligence — sessions, landing paths, converted
 *      sessions and product-attention signals from the TrafficEvent feed.
 *   4. Insight feed — deterministic, ranked, human-readable action items.
 *
 * Pure functions: the API route gathers data, this module decides.
 */

// ---------------------------------------------------------------------------
// 1. Revenue forecast
// ---------------------------------------------------------------------------

export interface DailyRevenuePoint {
  date: string; // YYYY-MM-DD
  revenue: number;
}

export interface ForecastPoint {
  /** 0-based index; negative indexes are historical, positive are future. */
  index: number;
  label: string;
  /** Historical actual revenue (undefined for future days). */
  actual?: number;
  /** Predicted revenue (undefined for historical days). */
  forecast?: number;
  /** 95% confidence band — undefined for historical days. */
  low?: number;
  high?: number;
}

export interface RevenueForecast {
  horizonDays: number;
  points: ForecastPoint[];
  summary: {
    /** Cumulative projected revenue over the next 7 days. */
    next7: number;
    /** Cumulative projected revenue over the next 14 days. */
    next14: number;
    /** Cumulative projected revenue over the next 30 days. */
    next30: number;
    /** Projected daily average over next 14 days. */
    dailyForecast: number;
    /** Current daily average (last 14 actual days). */
    dailyActual: number;
    /** Expected % change daily average forecast vs actual (can be negative). */
    trendPct: number;
    /** Mean absolute error of the model on historical data. */
    mae: number;
    /** Residual standard deviation (band width driver). */
    sigma: number;
    direction: 'growing' | 'declining' | 'flat';
    /** Number of daily data points the model was trained on. */
    trainedDays: number;
  };
}

const DAY_MS = 86_400_000;

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Build a continuous daily series (0-filled gaps) from sparse points. */
function fillDailySeries(points: DailyRevenuePoint[]): DailyRevenuePoint[] {
  if (points.length === 0) return [];
  const byDate = new Map(points.map((p) => [p.date, p.revenue]));
  const dates = [...byDate.keys()].sort();
  const start = new Date(dates[0] + 'T00:00:00.000Z');
  const end = new Date(dates[dates.length - 1] + 'T00:00:00.000Z');
  const out: DailyRevenuePoint[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = dateKey(cursor);
    out.push({ date: key, revenue: byDate.get(key) || 0 });
    cursor.setTime(cursor.getTime() + DAY_MS);
  }
  return out;
}

/**
 * Forecast the next `horizonDays` of daily revenue from a historical daily
 * series. Model: least-squares linear trend × day-of-week seasonality, with
 * a 95% confidence band that widens with forecast horizon.
 */
export function forecastRevenue(
  dailySeries: DailyRevenuePoint[],
  horizonDays = 14
): RevenueForecast {
  const series = fillDailySeries(dailySeries).slice(-90);
  const trainedDays = series.length;

  const empty = (): RevenueForecast => ({
    horizonDays,
    points: [],
    summary: {
      next7: 0,
      next14: 0,
      next30: 0,
      dailyForecast: 0,
      dailyActual: 0,
      trendPct: 0,
      mae: 0,
      sigma: 0,
      direction: 'flat',
      trainedDays,
    },
  });

  // Too little data to model anything sensible.
  if (trainedDays < 7) return empty();

  const n = series.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const ys = series.map((d) => d.revenue);

  // Least-squares linear regression: y = a + b·x
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - meanX) ** 2;
    sxy += (xs[i] - meanX) * (ys[i] - meanY);
  }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const intercept = meanY - slope * meanX;

  const predict = (x: number) => Math.max(0, intercept + slope * x);

  // Residuals → MAE + sigma for the confidence band.
  const residualErrors = ys.map((y, i) => y - predict(i));
  const mae = residualErrors.reduce((s, r) => s + Math.abs(r), 0) / n;
  const variance = residualErrors.reduce((s, r) => s + r ** 2, 0) / Math.max(1, n - 1);
  const sigma = Math.sqrt(variance);

  // Day-of-week seasonality multipliers (index 0 = Sunday … 6 = Saturday).
  const overallMean = meanY || 1;
  const weekdaySums = new Array(7).fill(0);
  const weekdayCounts = new Array(7).fill(0);
  series.forEach((d) => {
    const dow = new Date(d.date + 'T00:00:00.000Z').getUTCDay();
    weekdaySums[dow] += d.revenue;
    weekdayCounts[dow] += 1;
  });
  const weekdayFactor = weekdaySums.map((sum, i) =>
    weekdayCounts[i] > 0 && overallMean > 0 ? sum / weekdayCounts[i] / overallMean : 1
  );

  // Build the point series: historical + forecast (hist index < 0, future >= 0).
  // Project the full summary horizon (30d) internally, chart only `horizonDays`.
  const lastDate = new Date(series[series.length - 1].date + 'T00:00:00.000Z');
  const projDays = Math.max(horizonDays, 30);
  const projection: ForecastPoint[] = [];
  for (let k = 1; k <= projDays; k++) {
    const date = new Date(lastDate.getTime() + k * DAY_MS);
    const dow = date.getUTCDay();
    const base = predict(n - 1 + k);
    const forecast = Math.max(0, base * weekdayFactor[dow]);
    const wide = 1 + k / Math.max(10, projDays); // band widens with horizon
    const half = 1.96 * sigma * wide;
    projection.push({
      index: k,
      label: dateKey(date).slice(5),
      forecast: Math.round(forecast),
      low: Math.max(0, Math.round(forecast - half)),
      high: Math.round(forecast + half),
    });
  }
  const points: ForecastPoint[] = [
    ...series.map((d, i) => ({
      index: i - n + 1,
      label: d.date.slice(5),
      actual: Math.round(d.revenue),
    })),
    ...projection.slice(0, horizonDays),
  ];

  const sumForecast = (days: number) => {
    let total = 0;
    for (let k = 1; k <= days; k++) {
      total += projection[k - 1]?.forecast || 0;
    }
    return Math.round(total);
  };

  const next7 = sumForecast(7);
  const next14 = sumForecast(14);
  const next30 = sumForecast(30);
  const actualWindow = series.slice(-14).map((d) => d.revenue);
  const dailyActual = actualWindow.reduce((s, v) => s + v, 0) / Math.max(1, actualWindow.length);
  const dailyForecast = next14 / 14;
  const trendPct =
    dailyActual > 0 ? Math.round(((dailyForecast - dailyActual) / dailyActual) * 100 * 10) / 10 : 0;
  const direction: RevenueForecast['summary']['direction'] =
    trendPct >= 3 ? 'growing' : trendPct <= -3 ? 'declining' : 'flat';

  return {
    horizonDays,
    points,
    summary: {
      next7,
      next14,
      next30,
      dailyForecast: Math.round(dailyForecast),
      dailyActual: Math.round(dailyActual),
      trendPct,
      mae: Math.round(mae),
      sigma: Math.round(sigma),
      direction,
      trainedDays,
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Cohort retention
// ---------------------------------------------------------------------------

export interface CohortRow {
  /** Customer identity: user id, guest email, or ip-derived fallback. One row per order. */
  identity: string;
  createdAt: Date;
  total: number;
}

export interface CohortMonth {
  /** 0 = cohort month, 1 = one month after, … */
  monthIndex: number;
  /** Fraction of the cohort that placed a non-cancelled order that month. */
  retentionPct: number;
  active: number;
  revenue: number;
}

export interface Cohort {
  key: string; // YYYY-MM
  label: string; // e.g. "Mar 2026"
  size: number;
  revenue: number;
  months: CohortMonth[];
}

export interface CohortIntelligence {
  cohorts: Cohort[];
  /** Furthest month offset present across all cohorts. */
  maxMonths: number;
  /** Average retention of the most recent 3 cohorts at month 1. */
  m1Retention: number;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Order months + revenue per customer identity, keyed by YYYY-MM. */
function buildCustomerMonthMap(rows: CohortRow[]) {
  const identityMonths = new Map<string, Set<string>>();
  const identityMonthRevenue = new Map<string, Map<string, number>>();

  for (const row of rows) {
    if (!row.identity) continue;
    const key = monthKey(row.createdAt);
    const months = identityMonths.get(row.identity) || new Set<string>();
    months.add(key);
    identityMonths.set(row.identity, months);
    const revByMonth = identityMonthRevenue.get(row.identity) || new Map<string, number>();
    revByMonth.set(key, (revByMonth.get(key) || 0) + (row.total || 0));
    identityMonthRevenue.set(row.identity, revByMonth);
  }

  return { identityMonths, identityMonthRevenue };
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function computeCohortIntelligence(
  rows: CohortRow[],
  cohortCount = 8
): CohortIntelligence {
  const { identityMonths, identityMonthRevenue } = buildCustomerMonthMap(rows);

  // identity → first order month (cohort belonging).
  const firstOrderMonth = new Map<string, string>();
  const cohortRevenue = new Map<string, number>();
  for (const [identity, months] of identityMonths) {
    const sorted = [...months].sort();
    const first = sorted[0];
    firstOrderMonth.set(identity, first);
    const revByMonth = identityMonthRevenue.get(identity) || new Map();
    const rev = [...revByMonth.values()].reduce((s, v) => s + v, 0);
    cohortRevenue.set(first, (cohortRevenue.get(first) || 0) + rev);
  }

  const cohortSizes = new Map<string, number>();
  for (const firstMonth of firstOrderMonth.values()) {
    cohortSizes.set(firstMonth, (cohortSizes.get(firstMonth) || 0) + 1);
  }

  const cohortKeys = [...cohortSizes.keys()].sort().slice(-cohortCount);

  // Group monthly activity per cohort: offset → { active customers, revenue }.
  const cohortActivity = new Map<string, Map<number, { active: number; revenue: number }>>();
  for (const key of cohortKeys) {
    cohortActivity.set(key, new Map());
  }

  for (const [identity, first] of firstOrderMonth) {
    const activity = cohortActivity.get(first);
    if (!activity) continue;
    const revByMonth = identityMonthRevenue.get(identity) || new Map();
    const months = identityMonths.get(identity) || new Set();
    for (const m of months) {
      const offset = monthOffset(first, m);
      if (offset < 0) continue;
      const entry = activity.get(offset) || { active: 0, revenue: 0 };
      entry.active += 1;
      entry.revenue += revByMonth.get(m) || 0;
      activity.set(offset, entry);
    }
  }

  const cohorts: Cohort[] = cohortKeys.map((key) => {
    const size = cohortSizes.get(key) || 0;
    const activity = cohortActivity.get(key) || new Map();
    const maxOffset = Math.max(0, ...activity.keys());
    const months: CohortMonth[] = [];
    // Gap-fill: a customer active in month 2 is still assumed active in month 1
    // (standard "still around" cohort treatment).
    let lastActive = size;
    for (let offset = 0; offset <= maxOffset; offset++) {
      const entry = activity.get(offset);
      const active = entry ? entry.active : lastActive;
      lastActive = active;
      months.push({
        monthIndex: offset,
        retentionPct: size > 0 ? Math.round((active / size) * 1000) / 10 : 0,
        active,
        revenue: Math.round(entry?.revenue || 0),
      });
    }
    return {
      key,
      label: monthLabel(key),
      size,
      revenue: Math.round(cohortRevenue.get(key) || 0),
      months,
    };
  });

  const maxMonths = cohorts.reduce((mx, c) => Math.max(mx, c.months.length - 1), 0);
  const recent = cohorts.slice(-3).filter((c) => c.size > 0);
  const m1 =
    recent.length > 0
      ? Math.round(
          (recent.reduce((s, c) => s + (c.months.find((m) => m.monthIndex === 1)?.retentionPct || 0), 0) /
            recent.length) *
            10
        ) / 10
      : 0;

  return { cohorts, maxMonths, m1Retention: m1 };
}

function monthOffset(fromKey: string, toKey: string): number {
  const [fy, fm] = fromKey.split('-').map(Number);
  const [ty, tm] = toKey.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

// ---------------------------------------------------------------------------
// 3. Traffic & path intelligence (session reconstruction)
// ---------------------------------------------------------------------------

export interface TrafficEventLite {
  type: string;
  sessionId?: string;
  userId?: string;
  productId?: string;
  categoryId?: string;
  path?: string;
  source?: string;
  createdAt: Date;
}

export interface SessionStats {
  totalSessions: number;
  convertedSessions: number;
  conversionPct: number;
  avgEventsPerSession: number;
  avgStepsToConversion: number;
  topLandingPaths: Array<{ path: string; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
  convertedLastPaths: Array<{ path: string; count: number }>;
  hourly: Array<{ hour: number; events: number }>;
  sources: Array<{ source: string; views: number }>;
  trafficEvents: number;
}

export function computeTrafficIntelligence(
  events: TrafficEventLite[]
): SessionStats {
  const empty = (): SessionStats => ({
    totalSessions: 0,
    convertedSessions: 0,
    conversionPct: 0,
    avgEventsPerSession: 0,
    avgStepsToConversion: 0,
    topLandingPaths: [],
    topPaths: [],
    convertedLastPaths: [],
    hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, events: 0 })),
    sources: [],
    trafficEvents: events.length,
  });

  if (events.length === 0) return empty();

  const sessions = new Map<string, { paths: string[]; eventCount: number; converted: boolean }>();
  const evCountByPath = new Map<string, number>();
  const landingCount = new Map<string, number>();
  const convertedLast = new Map<string, number>();
  const hourly = new Array(24).fill(0);
  const sourceCount = new Map<string, number>();

  for (const ev of events) {
    const key = ev.sessionId || (ev.userId ? `u:${ev.userId}` : null);
    const path = ev.path || '/';
    evCountByPath.set(path, (evCountByPath.get(path) || 0) + 1);

    const hour = ev.createdAt ? new Date(ev.createdAt).getUTCHours() : 0;
    hourly[hour] = (hourly[hour] || 0) + 1;

    const source = ev.source || 'direct';
    sourceCount.set(source, (sourceCount.get(source) || 0) + 1);

    if (!key) continue;
    const session = sessions.get(key) || { paths: [], eventCount: 0, converted: false };
    session.eventCount += 1;
    session.converted = session.converted || ev.type === 'order_placed';
    session.paths.push(path);
    sessions.set(key, session);
  }

  for (const session of sessions.values()) {
    if (session.paths.length === 0) continue;
    const landing = session.paths[0];
    landingCount.set(landing, (landingCount.get(landing) || 0) + 1);
    if (session.converted && session.paths.length > 1) {
      const last = session.paths[session.paths.length - 1];
      convertedLast.set(last, (convertedLast.get(last) || 0) + 1);
    }
  }

  const top = (map: Map<string, number>, limit = 8) =>
    [...map.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

  const totalSessions = sessions.size;
  const convertedSessions = [...sessions.values()].filter((s) => s.converted).length;
  const avgEventsPerSession =
    totalSessions > 0
      ? Math.round(([...sessions.values()].reduce((s, x) => s + x.eventCount, 0) / totalSessions) * 10) / 10
      : 0;
  const convertedSessionEvents = [...sessions.values()].filter((s) => s.converted);
  const avgStepsToConversion =
    convertedSessionEvents.length > 0
      ? Math.round(
          (convertedSessionEvents.reduce((s, x) => s + x.eventCount, 0) / convertedSessionEvents.length) * 10
        ) / 10
      : 0;

  return {
    totalSessions,
    convertedSessions,
    conversionPct: totalSessions > 0 ? Math.round((convertedSessions / totalSessions) * 1000) / 10 : 0,
    avgEventsPerSession,
    avgStepsToConversion,
    topLandingPaths: top(landingCount),
    topPaths: top(evCountByPath),
    convertedLastPaths: top(convertedLast, 6),
    hourly: hourly.map((events, hour) => ({ hour, events })),
    sources: [...sourceCount.entries()]
      .map(([source, views]) => ({ source, views }))
      .sort((a, b) => b.views - a.views),
    trafficEvents: events.length,
  };
}

// ---------------------------------------------------------------------------
// 4. Product attention signals
// ---------------------------------------------------------------------------

export interface AttentionProduct {
  productId: string;
  name: string;
  slug?: string;
  price?: number;
  image?: string;
  windowViews: number;
  priorViews: number;
  deltaPct: number;
  /** Lifetime order sales count for the product (conversion proxy). */
  salesCount: number;
  /** True when attention is growing fast but conversion is weak. */
  rising: boolean;
  /** True when the product gets lots of views but sells almost nothing. */
  seenNotBought: boolean;
}

export function computeProductAttention(
  views: Array<{ productId: string; count: number; categoryId?: string }>,
  priorViews: Array<{ productId: string; count: number }>,
  productMeta: Map<string, { name: string; slug?: string; price?: number; image?: string; salesCount?: number }>,
  seenNotBoughtViewThreshold = 15
): AttentionProduct[] {
  const windowMap = new Map(views.map((v) => [String(v.productId), v.count]));
  const priorMap = new Map(priorViews.map((v) => [String(v.productId), v.count]));

  const ids = new Set([...windowMap.keys(), ...priorMap.keys()]);
  const out: AttentionProduct[] = [];

  for (const id of ids) {
    const meta = productMeta.get(id);
    if (!meta) continue; // product was deleted or filtered
    const windowViews = windowMap.get(id) || 0;
    const priorViewsCount = priorMap.get(id) || 0;
    const deltaPct =
      priorViewsCount > 0 ? Math.round(((windowViews - priorViewsCount) / priorViewsCount) * 100) : 100;
    out.push({
      productId: id,
      name: meta.name,
      slug: meta.slug,
      price: meta.price,
      image: meta.image,
      windowViews,
      priorViews: priorViewsCount,
      deltaPct,
      salesCount: meta.salesCount || 0,
      rising: windowViews >= 5 && priorViewsCount > 0 && deltaPct >= 50,
      seenNotBought: windowViews >= seenNotBoughtViewThreshold && (meta.salesCount || 0) <= 2,
    });
  }

  return out.sort((a, b) => b.windowViews - a.windowViews);
}

// ---------------------------------------------------------------------------
// 5. Insight feed
// ---------------------------------------------------------------------------

export interface SiInsight {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  title: string;
  detail: string;
  href?: string;
}

export interface InsightContext {
  forecast: RevenueForecast;
  cohorts: CohortIntelligence;
  traffic: SessionStats;
  attention: AttentionProduct[];
  periodDays: number;
  ordersInPeriod: number;
  revenueInPeriod: number;
}

export function generateStoreInsights(ctx: InsightContext): SiInsight[] {
  const insights: SiInsight[] = [];
  const { forecast, cohorts, traffic, attention, periodDays, ordersInPeriod, revenueInPeriod } = ctx;

  // Forecast direction.
  const t = forecast.summary;
  if (t.trainedDays >= 7) {
    if (t.trendPct <= -7) {
      insights.push({
        id: 'forecast-decline',
        severity: 'critical',
        title: `Revenue projected ${Math.abs(t.trendPct)}% below recent levels`,
        detail: `Daily average should drop from ৳${t.dailyActual.toLocaleString('en-IN')} to ৳${t.dailyForecast.toLocaleString('en-IN')} over the next 14 days. Plan stock and promos accordingly.`,
      });
    } else if (t.trendPct <= -3) {
      insights.push({
        id: 'forecast-soft',
        severity: 'warning',
        title: 'Revenue trend is softening',
        detail: `Next-14-day average (৳${t.dailyForecast.toLocaleString('en-IN')}) trails the recent daily average by ${Math.abs(t.trendPct)}%. Watch checkout and traffic conversion.`,
      });
    } else if (t.trendPct >= 7) {
      insights.push({
        id: 'forecast-growth',
        severity: 'positive',
        title: `Revenue trending up ${t.trendPct}%`,
        detail: `Next 14 days project to ৳${t.next14.toLocaleString('en-IN')}. Prioritise restocks on fast movers so demand doesn't outrun inventory.`,
      });
    }
  }

  // Cohort retention drop.
  if (cohorts.cohorts.length >= 2) {
    const latest = cohorts.cohorts[cohorts.cohorts.length - 1];
    const prev = cohorts.cohorts[cohorts.cohorts.length - 2];
    const latestM1 = latest.months.find((m) => m.monthIndex === 1)?.retentionPct ?? null;
    const prevM1 = prev.months.find((m) => m.monthIndex === 1)?.retentionPct ?? null;
    if (latestM1 !== null && prevM1 !== null && prevM1 - latestM1 >= 8) {
      insights.push({
        id: 'cohort-drop',
        severity: 'warning',
        title: `${latest.label} cohort retains ${latestM1}% vs ${prevM1}% previously`,
        detail: `New customers from ${latest.label} are returning at a lower rate. Consider an early second-purchase nudge for that cohort.`,
        href: '/admin/store-intelligence#cohorts',
      });
    }
  }

  // Traffic conversion.
  if (traffic.totalSessions > 0) {
    if (traffic.conversionPct < 2 && ordersInPeriod > 0) {
      insights.push({
        id: 'session-conversion',
        severity: 'warning',
        title: `Only ${traffic.conversionPct}% of sessions convert`,
        detail: `${traffic.totalSessions.toLocaleString()} sessions produced ${traffic.convertedSessions} sales. ${traffic.avgStepsToConversion} events per sale suggests a longer funnel — check checkout friction.`,
      });
    } else if (traffic.conversionPct >= 15) {
      insights.push({
        id: 'session-conversion-good',
        severity: 'positive',
        title: `Healthy ${traffic.conversionPct}% session conversion`,
        detail: `Strong path from browse to order. Feed more traffic into the best landing paths to scale it.`,
      });
    }
  }

  // Product attention — rising / seen-not-bought.
  const rising = attention
    .filter((a) => a.rising)
    .sort((a, b) => b.deltaPct - a.deltaPct)[0];
  if (rising) {
    insights.push({
      id: 'rising-product',
      severity: 'info',
      title: `${rising.name} is gaining attention`,
      detail: `${rising.windowViews} views in the last ${periodDays} days (${rising.deltaPct}% vs the prior period). Make sure it's in stock and featured.`,
      href: rising.slug ? `/admin/products/${rising.slug}` : undefined,
    });
  }

  const snb = attention
    .filter((a) => a.seenNotBought)
    .sort((a, b) => b.windowViews - a.windowViews)[0];
  if (snb) {
    insights.push({
      id: 'seen-not-bought',
      severity: 'warning',
      title: `${snb.name} is seen but not bought`,
      detail: `${snb.windowViews} views with almost no sales. Check price vs market, photos and stock. A short discount test could clarify demand.`,
      href: snb.slug ? `/admin/products/${snb.slug}` : undefined,
    });
  }

  // Busiest hour.
  const busiestHour = [...traffic.hourly].sort((a, b) => b.events - a.events)[0];
  if (busiestHour && busiestHour.events > 0) {
    insights.push({
      id: 'peak-hour',
      severity: 'info',
      title: `Traffic peaks around ${busiestHour.hour % 12 || 12}${busiestHour.hour < 12 ? 'am' : 'pm'}`,
      detail: `${busiestHour.events} events in that hour. Schedule flash offers, reminders and restock drops around it.`,
    });
  }

  // Volume sanity.
  if (traffic.trafficEvents === 0 && ordersInPeriod === 0) {
    insights.push({
      id: 'no-data',
      severity: 'info',
      title: 'Store intelligence needs more data',
      detail: `No traffic or order events in the last ${periodDays} days. This page comes alive as visitors browse and place orders.`,
    });
  }

  insights.push({
    id: 'period-summary',
    severity: 'info',
    title: `Period snapshot — ${ordersInPeriod} orders · ৳${revenueInPeriod.toLocaleString('en-IN')}`,
    detail: `${revenueInPeriod / Math.max(1, periodDays) < 1 ? '' : `Daily average ৳${Math.round(revenueInPeriod / Math.max(1, periodDays)).toLocaleString('en-IN')} across the last ${periodDays} days — `}use the range toggle to zoom into 7 / 30 / 90-day windows.`,
  });

  const rank = { critical: 0, warning: 1, info: 2, positive: 3 } as const;
  return insights.sort((a, b) => rank[a.severity] - rank[b.severity]);
}