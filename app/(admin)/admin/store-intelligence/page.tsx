'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Flame,
  Info,
  Minus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  ForecastChart,
  BarChart,
  HBarList,
  EmptyChart,
  type ChartDatum,
} from '@/components/admin/dashboard/charts';

// ---------------------------------------------------------------------------
// Types (mirror /api/admin/store-intelligence)
// ---------------------------------------------------------------------------

interface ForecastPoint {
  index: number;
  label: string;
  actual?: number;
  forecast?: number;
  low?: number;
  high?: number;
}

interface ForecastData {
  horizonDays: number;
  points: ForecastPoint[];
  summary: {
    next7: number;
    next14: number;
    next30: number;
    dailyForecast: number;
    dailyActual: number;
    trendPct: number;
    mae: number;
    sigma: number;
    direction: 'growing' | 'declining' | 'flat';
    trainedDays: number;
  };
}

interface CohortMonth {
  monthIndex: number;
  retentionPct: number;
  active: number;
  revenue: number;
}

interface Cohort {
  key: string;
  label: string;
  size: number;
  revenue: number;
  months: CohortMonth[];
}

interface TrafficData {
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

interface AttentionProduct {
  productId: string;
  name: string;
  slug?: string;
  price?: number;
  image?: string;
  windowViews: number;
  priorViews: number;
  deltaPct: number;
  salesCount: number;
  rising: boolean;
  seenNotBought: boolean;
}

interface SiInsight {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  title: string;
  detail: string;
  href?: string;
}

interface StoreIntelligenceData {
  generatedAt: string;
  range: { from: string; to: string; days: number };
  forecast: ForecastData;
  cohorts: { cohorts: Cohort[]; maxMonths: number; m1Retention: number };
  traffic: TrafficData;
  eventsByType: Record<string, number>;
  attention: AttentionProduct[];
  periods: { orders: number; revenue: number };
  insights: SiInsight[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtBDT = (n: number) => `৳${Math.round(n).toLocaleString('en-IN')}`;

function cohortColor(pct: number) {
  if (pct >= 60) return { bg: 'rgba(16,185,129,0.85)', text: '#fff' };
  if (pct >= 40) return { bg: 'rgba(16,185,129,0.55)', text: '#fff' };
  if (pct >= 20) return { bg: 'rgba(245,158,11,0.45)', text: '#78350f' };
  if (pct > 0) return { bg: 'rgba(239,68,68,0.28)', text: '#7f1d1d' };
  return { bg: 'rgba(148,163,184,0.12)', text: '#64748b' };
}

const INSIGHT_ICON = {
  critical: AlertTriangle,
  warning: TrendingDown,
  info: Info,
  positive: CheckCircle2,
} as const;

const INSIGHT_STYLE = {
  critical: 'border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-900/10',
  warning: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-900/10',
  info: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
  positive: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-900/10',
} as const;

const INSIGHT_TEXT = {
  critical: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-indigo-500 dark:text-indigo-400',
  positive: 'text-emerald-600 dark:text-emerald-400',
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminStoreIntelligencePage() {
  const [data, setData] = useState<StoreIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async (range: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/store-intelligence?days=${range}`);
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to load store intelligence.');
        return;
      }
      setData(result);
    } catch {
      setError('Network error while loading store intelligence.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  const switchRange = (next: number) => {
    if (next !== days) setDays(next);
  };

  const summary = data?.forecast?.summary;
  const DirectionIcon =
    summary?.direction === 'growing'
      ? ArrowUpRight
      : summary?.direction === 'declining'
        ? ArrowDownRight
        : Minus;
  const directionColor =
    summary?.direction === 'growing'
      ? 'text-emerald-600 dark:text-emerald-400'
      : summary?.direction === 'declining'
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-500 dark:text-gray-400';

  const kpis = [
    {
      label: '14-day forecast',
      value: summary ? fmtBDT(summary.next14) : undefined,
      icon: TrendingUp,
      color: 'text-indigo-500',
    },
    {
      label: '30-day forecast',
      value: summary ? fmtBDT(summary.next30) : undefined,
      icon: CalendarRange,
      color: 'text-violet-500',
    },
    {
      label: 'Daily avg ($)',
      sub: summary
        ? `actual ${fmtBDT(summary.dailyActual)}`
        : undefined,
      value: summary ? fmtBDT(summary.dailyForecast) : undefined,
      icon: Activity,
      color: 'text-emerald-500',
    },
    {
      label: 'Sessions',
      sub: data?.traffic
        ? `${data.traffic.conversionPct}% convert`
        : undefined,
      value: data?.traffic.totalSessions.toLocaleString('en-IN'),
      icon: Users,
      color: 'text-sky-500',
    },
    {
      label: 'Orders',
      sub: data ? fmtBDT(data.periods.revenue) : undefined,
      value: data?.periods.orders.toLocaleString('en-IN'),
      icon: ShoppingBag,
      color: 'text-amber-500',
    },
    {
      label: 'M1 retention',
      sub: 'recent cohorts',
      value: data?.cohorts.m1Retention ? `${data.cohorts.m1Retention}%` : undefined,
      icon: Flame,
      color: 'text-rose-500',
    },
  ];

  const forecastSeries = useMemo<ChartDatum[]>(
    () =>
      data
        ? data.traffic.hourly.map((h) => ({ label: `${h.hour}:00`, value: h.events }))
        : [],
    [data]
  );

  const rangeButtons = [7, 30, 90];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Store Intelligence</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Predictive revenue, cohort retention and traffic-path intelligence — one deterministic
            engine, no external keys required.
          </p>
          {data?.generatedAt && (
            <p className="mt-1 text-xs text-gray-400">
              Generated {new Date(data.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-600 dark:bg-gray-800">
            {rangeButtons.map((r) => (
              <button
                key={r}
                onClick={() => switchRange(r)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium',
                  days === r
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                {r}d
              </button>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" /> Deterministic engine
          </span>
          <button
            onClick={() => fetchData(days)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <k.icon className={cn('h-5 w-5', k.color)} />
            <p className="mt-2 text-lg font-bold leading-tight text-gray-900 dark:text-white">
              {loading ? '…' : (k.value ?? '—')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {k.label}
              {k.sub && <span className="ml-1 text-[10px] text-gray-400">· {k.sub}</span>}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="mt-4 h-40 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <BarChart3 className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            As orders and traffic events accumulate, forecasts, cohorts and path intelligence will
            appear here.
          </p>
        </div>
      ) : (
        <>
          {/* ── Insights feed ─────────────────────────────────────────── */}
          {data.insights.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Actionable insights
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {data.insights.map((ins) => {
                  const Icon = INSIGHT_ICON[ins.severity];
                  return (
                    <div
                      key={ins.id}
                      className={cn(
                        'rounded-xl border p-4',
                        INSIGHT_STYLE[ins.severity]
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', INSIGHT_TEXT[ins.severity])} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {ins.title}
                          </p>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{ins.detail}</p>
                          {ins.href && (
                            <Link
                              href={ins.href}
                              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              View product →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Revenue forecast ──────────────────────────────────────── */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Revenue forecast
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                  7d {fmtBDT(summary?.next7 ?? 0)}
                </span>
                <span className="rounded-full bg-violet-50 px-2.5 py-1 font-medium text-violet-600 dark:bg-violet-900/30 dark:text-violet-300">
                  14d {fmtBDT(summary?.next14 ?? 0)}
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
                  30d {fmtBDT(summary?.next30 ?? 0)}
                </span>
                {summary && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium',
                      directionColor,
                      summary.direction === 'growing'
                        ? 'bg-emerald-50 dark:bg-emerald-900/30'
                        : summary.direction === 'declining'
                          ? 'bg-red-50 dark:bg-red-900/30'
                          : 'bg-gray-100 dark:bg-gray-700'
                    )}
                  >
                    <DirectionIcon className="h-3.5 w-3.5" />
                    {summary.trendPct >= 0 ? `+${summary.trendPct}%` : `${summary.trendPct}%`} vs recent
                  </span>
                )}
              </div>
            </div>
            <ForecastChart
              points={data.forecast.points}
              format={fmtBDT}
            />
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span>
                Solid = actual · dashed = projection (95% confidence band)
              </span>
              <span>Model MAE: {fmtBDT(summary?.mae ?? 0)}/day</span>
              <span>Trained on {summary?.trainedDays ?? 0} days</span>
            </div>
          </section>

          {/* ── Cohort retention ──────────────────────────────────────── */}
          <section id="cohorts" className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-sky-500" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Cohort retention
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span className="h-3 w-3 rounded" style={{ background: 'rgba(148,163,184,0.15)' }} />
                <span>0%</span>
                <span className="h-3 w-3 rounded" style={{ background: 'rgba(239,68,68,0.3)' }} />
                <span>20%</span>
                <span className="h-3 w-3 rounded" style={{ background: 'rgba(245,158,11,0.5)' }} />
                <span>40%</span>
                <span className="h-3 w-3 rounded" style={{ background: 'rgba(16,185,129,0.85)' }} />
                <span>60%+</span>
              </div>
            </div>
            {data.cohorts.cohorts.length === 0 ? (
              <EmptyChart height={120} message="No cohort data yet — cohorts appear once customers place first orders." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate text-sm" style={{ borderSpacing: '3px' }}>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-1 pr-2 font-medium">Cohort</th>
                      <th className="py-1 pr-2 font-medium">Size</th>
                      <th className="py-1 pr-2 font-medium">Revenue</th>
                      {Array.from({ length: Math.min(data.cohorts.maxMonths, 9) }, (_, i) => i).map((m) => (
                        <th key={m} className="py-1 text-center font-medium">
                          M{m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.cohorts.cohorts.map((c) => (
                      <tr key={c.key}>
                        <td className="py-1 pr-2 font-medium text-gray-700 dark:text-gray-200">{c.label}</td>
                        <td className="py-1 pr-2 tabular-nums text-gray-600 dark:text-gray-300">{c.size}</td>
                        <td className="py-1 pr-2 tabular-nums text-gray-600 dark:text-gray-300">
                          {fmtBDT(c.revenue)}
                        </td>
                        {Array.from({ length: Math.min(data.cohorts.maxMonths, 9) }, (_, i) => i).map((m) => {
                          const month = c.months.find((mm) => mm.monthIndex === m);
                          if (!month) {
                            return (
                              <td key={m} className="h-9 min-w-[42px] rounded-md" style={{ background: 'rgba(148,163,184,0.06)' }} title="—" />
                            );
                          }
                          const { bg, text } = cohortColor(month.retentionPct);
                          return (
                            <td
                              key={m}
                              className="h-9 min-w-[42px] rounded-md text-center text-xs font-semibold tabular-nums"
                              style={{ background: bg, color: text }}
                              title={`${c.label} · M${m} · ${month.active}/${c.size} active · ${fmtBDT(month.revenue)}`}
                            >
                              {month.active > 0 ? `${month.retentionPct}%` : '·'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-gray-400">
              Retention = share of each cohort still ordering in that month. Hover a cell for active
              counts and monthly revenue.
            </p>
          </section>

          {/* ── Traffic & paths ───────────────────────────────────────── */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Traffic sources
                </h2>
              </div>
              {data.traffic.sources.length === 0 ? (
                <EmptyChart height={120} message="No traffic events in this window." />
              ) : (
                <HBarList
                  rows={data.traffic.sources.map((s) => ({
                    label: s.source,
                    value: s.views,
                  }))}
                  format={(n) => n.toLocaleString('en-IN')}
                  color="bg-emerald-500"
                />
              )}
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="rounded-lg bg-gray-100 px-2 py-1 dark:bg-gray-700">
                  {data.traffic.trafficEvents.toLocaleString('en-IN')} events
                </span>
                <span className="rounded-lg bg-gray-100 px-2 py-1 dark:bg-gray-700">
                  {data.eventsByType['product_view'] ?? 0} product views
                </span>
                <span className="rounded-lg bg-gray-100 px-2 py-1 dark:bg-gray-700">
                  {data.eventsByType['add_to_cart'] ?? 0} add-to-carts
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-500" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Sessions & paths
                </h2>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/40">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {data.traffic.totalSessions.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">sessions</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/40">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {data.traffic.convertedSessions.toLocaleString('en-IN')}
                    <span className="ml-1 text-xs font-medium text-gray-400">
                      ({data.traffic.conversionPct}%)
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">converted</p>
                </div>
              </div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                Top landing pages
              </p>
              {data.traffic.topLandingPaths.length === 0 ? (
                <EmptyChart height={80} message="No path data yet." />
              ) : (
                <HBarList
                  rows={data.traffic.topLandingPaths.slice(0, 5).map((p) => ({ label: p.path, value: p.count }))}
                  format={(n) => n.toLocaleString('en-IN')}
                  color="bg-amber-500"
                  empty="No path data yet."
                />
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-violet-500" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Activity by hour
                </h2>
              </div>
              <BarChart data={forecastSeries} format={(n) => n.toLocaleString('en-IN')} color="bg-violet-500" height={150} />
              <div className="mt-4 space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                <p>
                  Steps to purchase:{' '}
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {data.traffic.avgStepsToConversion || '—'} events
                  </span>
                </p>
                <p>
                  Avg session:{' '}
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {data.traffic.avgEventsPerSession || '—'} events
                  </span>
                </p>
              </div>
            </div>
          </section>

          {/* ── Product attention ─────────────────────────────────────── */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Rising attention
                </h2>
              </div>
              <div className="space-y-3">
                {data.attention.filter((a) => a.rising).slice(0, 6).length === 0 ? (
                  <EmptyChart height={120} message="No products with strongly rising attention yet." />
                ) : (
                  data.attention
                    .filter((a) => a.rising)
                    .slice(0, 6)
                    .map((a) => (
                      <div key={a.productId} className="flex items-center gap-3">
                        {a.image ? (
                          <img src={a.image} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                            <Eye className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <Link
                            href={a.slug ? `/admin/products/${a.slug}` : '#'}
                            className="block truncate text-sm font-medium text-gray-800 hover:text-primary dark:text-gray-200"
                          >
                            {a.name}
                          </Link>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {a.windowViews} views · prior period {a.priorViews}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-600 dark:bg-orange-900/30 dark:text-orange-300">
                          <ArrowUpRight className="h-3 w-3" /> +{a.deltaPct}%
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-3 flex items-center gap-2">
                <EyeOff className="h-5 w-5 text-red-500" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Seen but not bought
                </h2>
              </div>
              <div className="space-y-3">
                {data.attention.filter((a) => a.seenNotBought).slice(0, 6).length === 0 ? (
                  <EmptyChart height={120} message="No strong seen-but-not-bought signals — good." />
                ) : (
                  data.attention
                    .filter((a) => a.seenNotBought)
                    .slice(0, 6)
                    .map((a) => (
                      <div key={a.productId} className="flex items-center gap-3">
                        {a.image ? (
                          <img src={a.image} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <Link
                            href={a.slug ? `/admin/products/${a.slug}` : '#'}
                            className="block truncate text-sm font-medium text-gray-800 hover:text-primary dark:text-gray-200"
                          >
                            {a.name}
                          </Link>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {a.windowViews} views · {a.salesCount} lifetime sales
                          </p>
                        </div>
                        {a.price != null && (
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            {fmtBDT(a.price)}
                          </span>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}