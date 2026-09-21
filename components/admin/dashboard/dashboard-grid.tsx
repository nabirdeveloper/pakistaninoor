'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Activity,
  ArrowRight,
  BadgePercent,
  Boxes,
  CalendarClock,
  Coins,
  CreditCard,
  Crown,
  DollarSign,
  GripVertical,
  Hourglass,
  Lightbulb,
  Package,
  Percent,
  ShoppingCart,
  Sparkles,
  Star,
  Ticket as TicketIcon,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import {
  BarChart,
  ComboChart,
  DonutChart,
  EmptyChart,
  FunnelChart,
  GaugeRow,
  HeatmapChart,
  HBarList,
  LineChart,
  RadarChart,
  Sparkline,
  useCountUp,
  type ChartDatum,
} from './charts';
import {
  gatewayColors,
  kpiCards,
  shortDate,
  SPARK_COLORS,
  statusColors,
  timeAgo,
  fmtDuration,
  WIDGET_META,
  type AiInsights,
  type ChartRow,
  type DashboardData,
  type DashConfig,
  type KpiCardDef,
  type KpiDelta,
  type OverviewKey,
  type WidgetId,
} from './dashboard-shared';

// ---------------------------------------------------------------------------
// Drag plumbing for the widget cards.
// ---------------------------------------------------------------------------

interface DragState {
  dragId: string | null;
  overId: string | null;
  start: (id: string) => void;
  over: (id: string) => void;
  end: () => void;
  drop: (id: string) => void;
}

/**
 * Widget card shell. Defined at module scope (NOT inside the page component)
 * so its type identity is stable — otherwise every parent re-render would
 * unmount and remount every widget, destroying and rebuilding all charts.
 */
function WidgetCard({
  id,
  title,
  description,
  children,
  className,
  drag,
}: {
  id: WidgetId;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  drag: DragState;
}) {
  return (
    <section
      draggable
      onDragStart={(e) => {
        drag.start(id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={drag.end}
      onDragOver={(e) => {
        e.preventDefault();
        if (drag.overId !== id) drag.over(id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        drag.drop(id);
      }}
      className={cn(
        'group/card relative flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow dark:border-gray-700 dark:bg-gray-800',
        drag.dragId === id && 'opacity-60 ring-2 ring-primary',
        drag.overId === id && drag.dragId !== id && 'ring-2 ring-primary/60',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-3.5 dark:border-gray-700',
          drag.dragId === id && 'cursor-grabbing'
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical
            className={cn(
              'h-4 w-4 flex-shrink-0 text-gray-300 transition-colors dark:text-gray-600',
              'cursor-grab group-hover/card:text-gray-400 dark:group-hover/card:text-gray-400'
            )}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
            {description && <p className="truncate text-[11px] text-gray-400">{description}</p>}
          </div>
        </div>
        <span className="flex-shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 opacity-0 transition-opacity group-hover/card:opacity-100 dark:bg-gray-700">
          drag to reorder
        </span>
      </div>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}

/**
 * Defers mounting a widget (and its chart instance) until it approaches the
 * viewport. Once mounted it stays mounted, so scrolling back up is instant.
 */
function LazyMount({
  children,
  className,
  minHeight = 190,
}: {
  children: ReactNode;
  className?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // No IO support (or non-browser context) → render immediately, never lazy.
  const [inView, setInView] = useState(
    () => typeof window === 'undefined' || typeof IntersectionObserver === 'undefined'
  );

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: '360px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  if (inView) return <div className={className}>{children}</div>;
  return (
    <div
      ref={ref}
      className={cn(className, 'animate-pulse')}
      style={{ minHeight }}
      role="status"
      aria-label="Loading widget"
    >
      <div className="h-full w-full rounded-xl border border-gray-200 bg-gray-100/90 dark:border-gray-700 dark:bg-gray-800/80" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card (count-up + sparkline + delta badge)
// ---------------------------------------------------------------------------

function KpiCard({
  card,
  value,
  formatValue,
  spark,
  delta,
}: {
  card: KpiCardDef;
  value: number;
  formatValue: (n: number) => string;
  spark: number[];
  delta: KpiDelta | null;
}) {
  const animated = useCountUp(value);
  const showed = formatValue(animated);
  const sparkColor = SPARK_COLORS[card.color] || '#6366f1';
  const inner = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', card.bg)}>
          <card.icon className={cn('h-4 w-4', card.color)} />
        </div>
        <Sparkline data={spark} color={sparkColor} width={64} height={26} />
      </div>
      <p className="truncate text-sm font-bold tabular-nums text-gray-900 dark:text-white">{showed}</p>
      <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
        {card.label}
        {card.sub && <span className="text-gray-400 dark:text-gray-500"> · {card.sub}</span>}
      </p>
      {delta && (
        <span
          className={cn(
            'mt-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
            delta.pct === null
              ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
              : delta.pct >= 0
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          )}
          title={
            delta.pct === null
              ? `No previous-period baseline`
              : `Previous period: ${formatValue(delta.prev)}`
          }
        >
          {delta.pct === null
            ? 'New'
            : delta.pct >= 0
              ? `↑ ${delta.pct.toFixed(1)}%`
              : `↓ ${Math.abs(delta.pct).toFixed(1)}%`}
        </span>
      )}
    </>
  );
  return card.href ? (
    <Link
      href={card.href}
      className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 transition-colors hover:border-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/60 dark:hover:bg-gray-700/60"
    >
      {inner}
    </Link>
  ) : (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-800/60">
      {inner}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alerts widget — owns its tab state so switching tabs doesn't re-render the
// rest of the (chart-heavy) grid.
// ---------------------------------------------------------------------------

function AlertsCard({
  data,
  fmtCurrency,
  drag,
}: {
  data: DashboardData;
  fmtCurrency: (n: number) => string;
  drag: DragState;
}) {
  const [tab, setTab] = useState<'payment' | 'fraud' | 'inventory'>('payment');
  return (
    <WidgetCard id="alerts" title="Alerts" description="Payment, fraud & inventory watch" drag={drag}>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(['payment', 'fraud', 'inventory'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
              tab === t
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            )}
          >
            {t === 'payment' ? '⚡ Payment' : t === 'fraud' ? '🛡 Fraud' : '📦 Inventory'}
          </button>
        ))}
      </div>

      {tab === 'payment' && (
        <div className="space-y-2">
          {(data.live.paymentAlerts.recent || []).map((a) => (
            <div key={a._id} className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-900/20">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-red-800 dark:text-red-200">
                  Payment failed · {a.orderNumber}
                </p>
                <p className="truncate text-[11px] text-red-600 dark:text-red-400">
                  {a.method || 'unknown gateway'} · {a.city || '—'} · {timeAgo(a.createdAt)}
                </p>
              </div>
              <span className="flex-shrink-0 text-sm font-semibold text-red-700 dark:text-red-300">{fmtCurrency(a.total)}</span>
            </div>
          ))}
          {(data.live.paymentAlerts.recent || []).length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">No payment failures — all clear ✅</p>
          )}
        </div>
      )}

      {tab === 'fraud' && (
        <div className="space-y-2">
          {(data.live.fraudAlerts.recent || []).map((a) => (
            <div key={a._id} className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2.5 dark:bg-amber-900/20">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-amber-800 dark:text-amber-200">
                  {a.level === 'high' ? 'High' : 'Medium'} risk · {a.orderNumber}
                </p>
                <p className="truncate text-[11px] text-amber-600 dark:text-amber-400">
                  Score {a.score}/100 · {a.action?.replace('_', ' ')} · {a.city || '—'}
                </p>
              </div>
              <Link href={`/admin/orders/${a.orderNumber}`} className="flex-shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700 shadow-sm transition-colors hover:bg-amber-100 dark:bg-gray-800 dark:text-amber-300">
                Review →
              </Link>
            </div>
          ))}
          {(data.live.fraudAlerts.recent || []).length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">No fraud alerts — orders look clean 🛡</p>
          )}
        </div>
      )}

      {tab === 'inventory' && (
        <div className="space-y-2">
          {(data.live.inventoryAlerts || []).map((p) => (
            <Link
              key={p._id}
              href={`/admin/products/${p.slug}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-orange-50 px-3 py-2.5 transition-colors hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- product thumbnails, sized container
                  <img src={p.image} alt="" className="h-8 w-8 flex-shrink-0 rounded object-cover" />
                ) : (
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-orange-100 dark:bg-orange-900/40">
                    <Package className="h-4 w-4 text-orange-500" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-orange-800 dark:text-orange-200">{p.name}</p>
                  <p className="truncate text-[11px] text-orange-600 dark:text-orange-400">
                    {p.stock === 0 ? 'Out of stock' : `Stock ${p.stock}`} · threshold {p.threshold}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-orange-400" />
            </Link>
          ))}
          {(data.live.inventoryAlerts || []).length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">Inventory levels are healthy 📦</p>
          )}
          <div>
            <Link href="/admin/inventory" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Manage inventory <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

// ---------------------------------------------------------------------------
// Funnel widget — owns its stage-inspection modal state.
// ---------------------------------------------------------------------------

const FUNNEL_STAGES: Array<{ label: string; key: keyof DashboardData['charts']['funnel']; tip: string }> = [
  { label: 'Visitors', key: 'visitors', tip: 'Drive more traffic with campaigns, SEO and social promotion.' },
  { label: 'Product views', key: 'productViews', tip: 'Improve discoverability — tighten categories, filters and search ranking.' },
  { label: 'Add to cart', key: 'addToCart', tip: 'Reduce page friction — check pricing, images, reviews and stock badges.' },
  { label: 'Checkout', key: 'checkout', tip: 'Lower checkout abandonment — guest checkout and clear shipping options.' },
  { label: 'Orders placed', key: 'orders', tip: 'Confirm orders faster with instant payment confirmations.' },
  { label: 'Delivered', key: 'delivered', tip: 'Faster dispatch and reliable couriers lift repeat sales.' },
];

function FunnelCard({
  data,
  fmtInt,
  drag,
}: {
  data: DashboardData;
  fmtInt: (n: number) => string;
  drag: DragState;
}) {
  const [stage, setStage] = useState<number | null>(null);
  return (
    <>
      <WidgetCard id="funnel" title="Conversion Funnel" description="Visitor → delivered — click a stage to inspect it" drag={drag}>
        <FunnelChart
          stages={FUNNEL_STAGES.map((s) => ({
            label: s.label,
            value: data.charts.funnel[s.key] || 0,
          }))}
          format={fmtInt}
          onStageClick={setStage}
          toolbar
          title="Conversion Funnel"
        />
      </WidgetCard>
      <AnimatePresence>
        {stage !== null &&
          (() => {
            const funnel = FUNNEL_STAGES[stage];
            if (!funnel) return null;
            const value = data.charts.funnel[funnel.key] || 0;
            const first = data.charts.funnel.visitors || 0;
            const prev = stage > 0 ? data.charts.funnel[FUNNEL_STAGES[stage - 1].key] || 0 : 0;
            const overall = first > 0 ? (value / first) * 100 : 0;
            const stepConv = prev > 0 ? (value / prev) * 100 : 0;
            const drop = stage > 0 && prev > 0 ? Math.max(0, 100 - stepConv) : 0;
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                onClick={() => setStage(null)}
              >
                <motion.div
                  initial={{ scale: 0.96, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.96, y: 10 }}
                  className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold capitalize text-gray-900 dark:text-white">{funnel.label}</h2>
                      <p className="text-sm text-gray-500">Conversion funnel stage</p>
                    </div>
                    <button onClick={() => setStage(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-indigo-50 px-2 py-2 dark:bg-indigo-900/20">
                      <p className="text-lg font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{fmtInt(value)}</p>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400">Users</p>
                    </div>
                    <div className="rounded-lg bg-teal-50 px-2 py-2 dark:bg-teal-900/20">
                      <p className="text-lg font-bold tabular-nums text-teal-700 dark:text-teal-300">{overall.toFixed(1)}%</p>
                      <p className="text-[10px] text-teal-600 dark:text-teal-400">Of visitors</p>
                    </div>
                    <div className="rounded-lg bg-purple-50 px-2 py-2 dark:bg-purple-900/20">
                      <p className="text-lg font-bold tabular-nums text-purple-700 dark:text-purple-300">{stage > 0 ? `${stepConv.toFixed(1)}%` : '—'}</p>
                      <p className="text-[10px] text-purple-600 dark:text-purple-400">Step conv.</p>
                    </div>
                  </div>
                  {stage > 0 ? (
                    <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                      {drop > 0
                        ? `${drop.toFixed(1)}% of users dropped off between ${FUNNEL_STAGES[stage - 1].label.toLowerCase()} and ${funnel.label.toLowerCase()}.`
                        : 'No drop-off at this step — great job! 🎉'}
                    </div>
                  ) : null}
                  <div className="flex items-start gap-2.5 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-gray-700/50 dark:text-gray-300">
                    <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" />
                    <p>{funnel.tip}</p>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Activity feed icon
// ---------------------------------------------------------------------------

function activityIcon(type: string) {
  switch (type) {
    case 'order':
      return <ShoppingCart className="h-3.5 w-3.5" />;
    case 'customer':
      return <UserPlus className="h-3.5 w-3.5" />;
    case 'review':
      return <Star className="h-3.5 w-3.5" />;
    default:
      return <TicketIcon className="h-3.5 w-3.5" />;
  }
}

// ---------------------------------------------------------------------------
// The widget grid.
// ---------------------------------------------------------------------------

interface DashboardGridProps {
  data: DashboardData;
  aiInsights: AiInsights | null;
  fmtCurrency: (n: number) => string;
  fmtInt: (n: number) => string;
  fmtPct: (n: number) => string;
  config: DashConfig;
  onReorder: (from: string, targetId: string) => void;
}

function DashboardGridImpl({
  data,
  aiInsights,
  fmtCurrency,
  fmtInt,
  fmtPct,
  config,
  onReorder,
}: DashboardGridProps) {
  // ── Drag & drop state (kept here — ops on it only re-render the grid) ──
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const endDrag = useCallback(() => {
    setDragId(null);
    setOverId(null);
  }, []);
  const startDrag = useCallback((id: string) => setDragId(id), []);
  const overDrag = useCallback((id: string) => setOverId(id), []);
  const dropDrag = useCallback(
    (targetId: string) => {
      setDragId((from) => {
        if (from && from !== targetId) onReorder(from, targetId);
        return null;
      });
      setOverId(null);
    },
    [onReorder]
  );
  const drag = useMemo<DragState>(
    () => ({ dragId, overId, start: startDrag, over: overDrag, end: endDrag, drop: dropDrag }),
    [dragId, overId, startDrag, overDrag, endDrag, dropDrag]
  );

  const isEnabled = useCallback(
    (id: WidgetId | OverviewKey) => !config.disabled[id],
    [config.disabled]
  );

  // Sparkline series per KPI (daily values for the selected period).
  const sparks = useMemo(() => {
    const rev = data.charts.revenue.map((r) => r.revenue || 0);
    const ord = data.charts.orders.map((r) => r.count || 0);
    const units = data.charts.sales.map((r) => r.units || 0);
    const cust = data.charts.customerGrowth.map((r) => r.count || 0);
    const aov = data.charts.revenue.map((r, i) => {
      const o = data.charts.orders[i]?.count || 0;
      return o > 0 ? Math.round(((r.revenue || 0) / o) * 100) / 100 : 0;
    });
    return {
      totalSales: units,
      totalOrders: ord,
      totalCustomers: cust,
      totalProducts: units,
      totalRevenue: rev,
      netRevenue: rev,
      grossProfit: rev,
      averageOrderValue: aov,
      conversionRate: ord,
      returningCustomerRate: ord,
      refundAmount: rev,
      cancelledOrders: ord,
      pendingOrders: ord,
      lowStockProducts: units,
      outOfStockProducts: units,
      inventoryValue: rev,
      inventoryUnits: units,
      couponSavings: rev,
      couponOrders: ord,
      pendingRefunds: ord,
      pendingRefundAmount: rev,
    } as Record<OverviewKey, number[]>;
  }, [data]);

  // % change vs the previous period for the KPI cards that have a baseline.
  const deltas = useMemo(() => {
    const out: Partial<Record<OverviewKey, KpiDelta>> = {};
    const c = data.comparison;
    const pct = (cur: number, prev: number): number | null =>
      prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? null : 0;
    out.totalOrders = { pct: pct(data.overview.totalOrders, c.prevOrders), prev: c.prevOrders };
    out.totalRevenue = { pct: pct(data.overview.totalRevenue, c.prevRevenue), prev: c.prevRevenue };
    out.netRevenue = { pct: pct(data.overview.netRevenue, c.prevRevenue), prev: c.prevRevenue };
    out.grossProfit = { pct: pct(data.overview.grossProfit, c.prevRevenue), prev: c.prevRevenue };
    out.averageOrderValue = {
      pct:
        c.prevOrders > 0
          ? pct(data.overview.averageOrderValue, c.prevRevenue / c.prevOrders)
          : null,
      prev: c.prevOrders > 0 ? Math.round((c.prevRevenue / c.prevOrders) * 100) / 100 : 0,
    };
    out.totalSales = { pct: pct(data.overview.totalSales, c.prevUnits), prev: c.prevUnits };
    out.totalCustomers = { pct: pct(data.overview.totalCustomers, c.prevCustomers), prev: c.prevCustomers };
    return out;
  }, [data]);

  const toChartData = useCallback(
    (rows: ChartRow[], valueKey: 'revenue' | 'orders' | 'count' | 'units'): ChartDatum[] =>
      (rows || []).map((r) => ({ label: shortDate(r._id), value: r[valueKey] || 0 })),
    []
  );

  const renderWidget = useCallback(
    (id: WidgetId): ReactNode => {
      switch (id) {
        case 'overview': {
          const visibleKpis = kpiCards.filter((card) => isEnabled(card.key));
          const formatFor = (card: KpiCardDef) => (n: number) => {
            if (card.format === 'currency') return fmtCurrency(n);
            if (card.format === 'pct') return fmtPct(n);
            return fmtInt(n);
          };
          return (
            <WidgetCard id="overview" title="Overview" description="Headline store metrics for the selected period" drag={drag}>
              {visibleKpis.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">
                  All overview metrics are hidden — enable them in Customize.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {visibleKpis.map((card) => (
                    <KpiCard
                      key={card.key}
                      card={card}
                      value={data.overview[card.key] ?? 0}
                      formatValue={formatFor(card)}
                      spark={sparks[card.key] || []}
                      delta={deltas[card.key] || null}
                    />
                  ))}
                </div>
              )}
            </WidgetCard>
          );
        }

        case 'live':
          return (
            <WidgetCard id="live" title="Live Pulse" description="Real-time store activity" drag={drag}>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: 'Live Orders', value: fmtInt(data.live.liveOrders), sub: 'last 24 hours', icon: ShoppingCart, color: 'text-blue-600' },
                  { label: 'Live Visitors', value: fmtInt(data.live.liveVisitors), sub: 'active now (30 min)', icon: Users, color: 'text-purple-600' },
                  { label: 'Live Checkout', value: fmtInt(data.live.liveCheckout), sub: 'curated carts active', icon: CreditCard, color: 'text-amber-600' },
                  { label: 'Live Revenue', value: fmtCurrency(data.live.liveRevenue), sub: 'earned today', icon: DollarSign, color: 'text-green-600' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="relative flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3.5 dark:border-gray-700 dark:bg-gray-800/60"
                  >
                    <span className="absolute right-3 top-3 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                    </span>
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', s.color.includes('blue') ? 'bg-blue-100 dark:bg-blue-900/20' : s.color.includes('purple') ? 'bg-purple-100 dark:bg-purple-900/20' : s.color.includes('amber') ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-green-100 dark:bg-green-900/20')}>
                      <s.icon className={cn('h-5 w-5', s.color)} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
                      <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                        {s.label} · {s.sub}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </WidgetCard>
          );

        case 'revenue':
          return (
            <WidgetCard id="revenue" title="Revenue Analytics" description="Daily revenue (completed sales)" drag={drag}>
              <LineChart data={toChartData(data.charts.revenue, 'revenue')} format={fmtCurrency} color="#6366f1" toolbar zoom title="Revenue Analytics" />
            </WidgetCard>
          );

        case 'sales':
          return (
            <WidgetCard id="sales" title="Sales Analytics" description="Units sold per day" drag={drag}>
              <BarChart data={toChartData(data.charts.sales, 'units')} format={fmtInt} color="bg-blue-500" toolbar zoom title="Sales Analytics" />
            </WidgetCard>
          );

        case 'orders':
          return (
            <WidgetCard id="orders" title="Order Analytics" description="Orders placed per day" drag={drag}>
              <LineChart data={toChartData(data.charts.orders, 'count')} format={fmtInt} color="#ec4899" toolbar zoom title="Order Analytics" />
            </WidgetCard>
          );

        case 'customers':
          return (
            <WidgetCard id="customers" title="Customer Growth" description="New customer accounts per day" drag={drag}>
              <BarChart data={toChartData(data.charts.customerGrowth, 'count')} format={fmtInt} color="bg-purple-500" toolbar zoom title="Customer Growth" />
            </WidgetCard>
          );

        case 'products':
          return (
            <WidgetCard id="products" title="Product Performance" description="Top sellers by revenue" drag={drag}>
              <HBarList
                rows={data.charts.productPerformance.map((p) => ({
                  label: p.name,
                  value: p.revenue,
                  sub: `${p.units} sold`,
                  image: p.image,
                }))}
                format={fmtCurrency}
                color="bg-indigo-500"
              />
            </WidgetCard>
          );

        case 'categories':
          return (
            <WidgetCard id="categories" title="Category Performance" description="Revenue by category" drag={drag}>
              <HBarList
                rows={data.charts.categoryPerformance.map((c) => ({
                  label: c.name,
                  value: c.revenue,
                  sub: `${c.units} units`,
                }))}
                format={fmtCurrency}
                color="bg-emerald-500"
              />
            </WidgetCard>
          );

        case 'traffic': {
          const traffic = data.charts.traffic || [];
          const totalViews = traffic.reduce((s, d) => s + (d.views || 0), 0);
          const totalCarts = traffic.reduce((s, d) => s + (d.carts || 0), 0);
          const totalOrders = traffic.reduce((s, d) => s + (d.orders || 0), 0);
          const viewToCart = totalViews > 0 ? ((totalCarts / totalViews) * 100).toFixed(1) : '0.0';
          const cartToOrder = totalCarts > 0 ? ((totalOrders / totalCarts) * 100).toFixed(1) : '0.0';
          const viewToOrder = totalViews > 0 ? ((totalOrders / totalViews) * 100).toFixed(1) : '0.0';
          return (
            <WidgetCard id="traffic" title="Traffic Analytics" description="Views, cart adds & orders per day" drag={drag}>
              {traffic.length === 0 ? (
                <EmptyChart height={190} message="No traffic events yet — product views, cart adds and checkouts will appear here." />
              ) : (
                <div className="space-y-4">
                  <LineChart
                    data={traffic.map((d) => ({ label: shortDate(d._id), value: d.views }))}
                    format={fmtInt}
                    color="#14b8a6"
                    height={120}
                    toolbar
                    title="Traffic Analytics — Views"
                  />
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-cyan-50 px-2 py-2 dark:bg-cyan-900/20">
                      <p className="text-base font-bold text-cyan-700 dark:text-cyan-300">{fmtInt(totalViews)}</p>
                      <p className="text-[10px] text-cyan-600 dark:text-cyan-400">Views</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 px-2 py-2 dark:bg-blue-900/20">
                      <p className="text-base font-bold text-blue-700 dark:text-blue-300">{fmtInt(totalCarts)}</p>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400">Cart adds</p>
                    </div>
                    <div className="rounded-lg bg-purple-50 px-2 py-2 dark:bg-purple-900/20">
                      <p className="text-base font-bold text-purple-700 dark:text-purple-300">{fmtInt(totalOrders)}</p>
                      <p className="text-[10px] text-purple-600 dark:text-purple-400">Orders</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-teal-50 px-2 py-1.5 dark:bg-teal-900/20">
                      <p className="text-sm font-bold text-teal-700 dark:text-teal-300">{viewToCart}%</p>
                      <p className="text-[10px] text-teal-600 dark:text-teal-400">Views → Cart</p>
                    </div>
                    <div className="rounded-lg bg-indigo-50 px-2 py-1.5 dark:bg-indigo-900/20">
                      <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{cartToOrder}%</p>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400">Cart → Order</p>
                    </div>
                    <div className="rounded-lg bg-fuchsia-50 px-2 py-1.5 dark:bg-fuchsia-900/20">
                      <p className="text-sm font-bold text-fuchsia-700 dark:text-fuchsia-300">{viewToOrder}%</p>
                      <p className="text-[10px] text-fuchsia-600 dark:text-fuchsia-400">Views → Order</p>
                    </div>
                  </div>
                  {(data.charts.trafficSources?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(data.charts.trafficSources || []).map((s) => (
                        <span key={s.source} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium capitalize text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {s.source.replace('_', ' ')} · {fmtInt(s.views)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </WidgetCard>
          );
        }

        case 'funnel':
          return <FunnelCard data={data} fmtInt={fmtInt} drag={drag} />;

        case 'geography':
          return (
            <WidgetCard id="geography" title="Geographic Sales" description="Top delivery cities" drag={drag}>
              <HBarList
                rows={data.charts.geography.map((g) => ({
                  label: g.city,
                  value: g.revenue,
                  sub: `${g.orders} orders`,
                }))}
                format={fmtCurrency}
                color="bg-amber-500"
              />
            </WidgetCard>
          );

        case 'payments': {
          const methods = data.charts.paymentMethods
            .slice()
            .sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
          const totalRevenue = methods.reduce((s, m) => s + (m.revenue || 0), 0);
          const totalOrders = methods.reduce((s, m) => s + (m.orders || 0), 0);
          const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
          return (
            <WidgetCard id="payments" title="Payment Methods" description="Orders & revenue by gateway" drag={drag}>
              {methods.length === 0 ? (
                <EmptyChart height={150} message="No payment data in this period yet." />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-green-50 px-2 py-2 dark:bg-green-900/20">
                      <p className="text-base font-bold text-green-700 dark:text-green-300">{fmtCurrency(totalRevenue)}</p>
                      <p className="text-[10px] text-green-600 dark:text-green-400">Revenue</p>
                    </div>
                    <div className="rounded-lg bg-indigo-50 px-2 py-2 dark:bg-indigo-900/20">
                      <p className="text-base font-bold text-indigo-700 dark:text-indigo-300">{fmtInt(totalOrders)}</p>
                      <p className="text-[10px] text-indigo-600 dark:text-indigo-400">Orders</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 px-2 py-2 dark:bg-amber-900/20">
                      <p className="text-base font-bold text-amber-700 dark:text-amber-300">{fmtCurrency(avgOrder)}</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">Avg order</p>
                    </div>
                  </div>
                  <DonutChart
                    data={methods.map((p) => ({
                      label: (p.method || 'unknown').replace('_', ' '),
                      value: p.revenue,
                      color: gatewayColors[(p.method || 'unknown').toLowerCase()] || undefined,
                    }))}
                    format={fmtCurrency}
                    centerLabel="Revenue"
                    toolbar
                    title="Payment Methods"
                  />
                </div>
              )}
            </WidgetCard>
          );
        }

        case 'recentOrders':
          return (
            <WidgetCard id="recentOrders" title="Recent Orders" description="Latest orders" drag={drag}>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {(data.live.recentOrders || []).map((o) => (
                  <Link
                    key={o._id}
                    href={`/admin/orders/${o.orderNumber}`}
                    className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{o.orderNumber}</p>
                      <p className="truncate text-[11px] text-gray-500">{o.user?.name || 'Guest'} · {timeAgo(o.createdAt)}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{fmtCurrency(o.total)}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusColors[o.status] || 'bg-gray-100 text-gray-600')}>
                        {o.status.replace('_', ' ')}
                      </span>
                    </div>
                  </Link>
                ))}
                {(data.live.recentOrders || []).length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-400">No orders yet.</p>
                )}
                <div className="pt-2">
                  <Link href="/admin/orders" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    View all orders <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </WidgetCard>
          );

        case 'activities':
          return (
            <WidgetCard id="activities" title="Recent Activity" description="Live events feed" drag={drag}>
              <div className="space-y-1">
                {(data.live.recentActivities || []).map((a) => (
                  <Link
                    key={a.key}
                    href={a.href}
                    className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                      {activityIcon(a.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-100">{a.title}</p>
                      <p className="truncate text-[11px] text-gray-500">{a.detail}</p>
                    </div>
                    <span className="flex-shrink-0 text-[10px] text-gray-400">{timeAgo(a.time)}</span>
                  </Link>
                ))}
                {(data.live.recentActivities || []).length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-400">No activity yet.</p>
                )}
              </div>
            </WidgetCard>
          );

        case 'newCustomers':
          return (
            <WidgetCard id="newCustomers" title="New Customers" description={`${fmtInt(data.live.newCustomers.count)} in this period`} drag={drag}>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {(data.live.newCustomers.recent || []).map((u) => (
                  <div key={u._id} className="flex items-center justify-between gap-2 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-100">{u.name}</p>
                        <p className="truncate text-[11px] text-gray-500">{u.email}</p>
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-[10px] text-gray-400">{timeAgo(u.createdAt)}</span>
                  </div>
                ))}
                {(data.live.newCustomers.recent || []).length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-400">No new customers in this period.</p>
                )}
                <div className="pt-2">
                  <Link href="/admin/customers" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    View all customers <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </WidgetCard>
          );

        case 'tickets':
          return (
            <WidgetCard id="tickets" title="Support Tickets" description={`${fmtInt(data.live.supportTickets.open)} open`} drag={drag}>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {(data.live.supportTickets.recent || []).map((t) => (
                  <Link
                    key={t._id}
                    href="/admin/support-triage"
                    className="flex items-center justify-between gap-2 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-100">{t.subject}</p>
                      <p className="truncate text-[11px] text-gray-500">{t.ticketNumber} · {timeAgo(t.createdAt)}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        t.priority === 'urgent'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : t.priority === 'high'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                            : t.priority === 'low'
                              ? 'bg-gray-100 text-gray-600 dark:bg-gray-700'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                      )}>
                        {t.priority}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium capitalize text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  </Link>
                ))}
                {(data.live.supportTickets.recent || []).length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-400">No tickets yet.</p>
                )}
              </div>
            </WidgetCard>
          );

        case 'alerts':
          return <AlertsCard data={data} fmtCurrency={fmtCurrency} drag={drag} />;

        case 'ai':
          return aiInsights ? (
            <WidgetCard id="ai" title="AI Insights" description="Machine-generated store analysis" drag={drag}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    aiInsights.source === 'ai_service'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  )}
                >
                  {aiInsights.source === 'ai_service' ? 'AI Engine' : 'Local Fallback'}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Activity className="h-3.5 w-3.5" /> Health {aiInsights.health_score}/100
                </span>
              </div>
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                    <Lightbulb className="h-3.5 w-3.5 text-indigo-500" /> What&apos;s happening
                  </h3>
                  <ul className="space-y-2">
                    {(aiInsights.insights || []).map((ins: string, i: number) => (
                      <li key={i} className="text-[13px] text-gray-600 dark:text-gray-300">{ins}</li>
                    ))}
                    {(aiInsights.insights || []).length === 0 && <li className="text-[13px] text-gray-400">Not enough data yet.</li>}
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" /> Recommended actions
                  </h3>
                  <ul className="space-y-2">
                    {(aiInsights.suggestions || []).map((s: string, i: number) => (
                      <li key={i} className="text-[13px] text-purple-700 dark:text-purple-300">{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Revenue forecast
                  </h3>
                  {(() => {
                    const forecast = aiInsights.forecast || [];
                    const maxRev = Math.max(0, ...forecast.map((x) => x.revenue));
                    return forecast.length > 0 ? (
                      <>
                        <div className="flex h-24 items-end gap-1.5">
                          {forecast.map((f, i) => (
                            <div key={i} className="flex-1" title={`${f.date}: ${fmtCurrency(f.revenue)}`}>
                              <div className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-purple-500" style={{ height: `${maxRev > 0 ? Math.max(6, (f.revenue / maxRev) * 100) : 6}%` }} />
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-gray-400">Projected revenue · next {forecast.length} days</p>
                      </>
                    ) : (
                      <p className="text-[13px] text-gray-400">Add more completed orders to unlock forecasting.</p>
                    );
                  })()}
                </div>
              </div>
            </WidgetCard>
          ) : null;

        case 'inventory': {
          const byCategory = data.inventory.byCategory || [];
          return (
            <WidgetCard id="inventory" title="Inventory Snapshot" description="Stock value & health (tracked products)" drag={drag}>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: 'Units in stock', value: fmtInt(data.inventory.units), icon: Boxes, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/20' },
                  { label: 'Value at cost', value: fmtCurrency(data.inventory.costValue), icon: Coins, color: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-900/20' },
                  { label: 'Value at retail', value: fmtCurrency(data.inventory.retailValue), icon: Warehouse, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/20' },
                  { label: 'Potential profit', value: fmtCurrency(data.inventory.potentialProfit), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/20' },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                    <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', s.bg)}>
                      <s.icon className={cn('h-4 w-4', s.color)} />
                    </div>
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{s.value}</p>
                    <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>
              {byCategory.length > 0 ? (
                <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
                  <h3 className="mb-3 text-xs font-semibold text-gray-700 dark:text-gray-200">Inventory value by category</h3>
                  <HBarList
                    rows={byCategory.map((c) => ({
                      label: c.name,
                      value: c.retailValue,
                      sub: `${fmtInt(c.units)} units`,
                    }))}
                    format={fmtCurrency}
                    color="bg-amber-500"
                  />
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-gray-700">
                  No tracked inventory yet — set prices & cost in product settings.
                </p>
              )}
              <div className="mt-4">
                <Link href="/admin/inventory" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Manage inventory <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </WidgetCard>
          );
        }

        case 'promos': {
          const byCoupon = data.promos.byCoupon || [];
          return (
            <WidgetCard id="promos" title="Promotions" description="Coupon & discount performance" drag={drag}>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Discount given', value: fmtCurrency(data.promos.totalDiscount), icon: BadgePercent, color: 'text-pink-600' },
                  { label: 'Coupon orders', value: fmtInt(data.promos.couponOrders), icon: Percent, color: 'text-fuchsia-600' },
                  { label: 'Coupon revenue', value: fmtCurrency(data.promos.couponRevenue), icon: DollarSign, color: 'text-green-600' },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-700/50">
                    <div className="flex items-center gap-1.5">
                      <s.icon className={cn('h-3.5 w-3.5', s.color)} />
                      <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">{s.label}</p>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-bold text-gray-900 dark:text-white">{s.value}</p>
                  </div>
                ))}
              </div>
              {byCoupon.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200">Top coupons this period</h3>
                  {byCoupon.map((c) => (
                    <div key={c.code} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold text-gray-900 dark:text-white">{c.code}</p>
                        <p className="truncate text-[11px] text-gray-500">
                          {fmtInt(c.orders)} orders · {fmtCurrency(c.revenue)} revenue
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-xs font-semibold text-pink-600 dark:text-pink-400">
                        −{fmtCurrency(c.discount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-gray-700">
                  No coupon orders this period — create coupons in Marketing to drive sales.
                </p>
              )}
              <div className="mt-4">
                <Link href="/admin/campaigns" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Manage campaigns & coupons <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </WidgetCard>
          );
        }

        case 'hourly': {
          const hours = data.hourly || [];
          const peak = hours.reduce((best, h) => (h.orders > best.orders ? h : best), { hour: -1, orders: 0, revenue: 0 });
          return (
            <WidgetCard id="hourly" title="Peak Hours" description="Order volume by hour of day" drag={drag}>
              {hours.length > 0 && hours.some((h) => h.orders > 0) ? (
                <>
                  <BarChart
                    data={hours.map((h) => ({ label: `${String(h.hour).padStart(2, '0')}:00`, value: h.orders }))}
                    format={fmtInt}
                    color="bg-indigo-500"
                    height={170}
                    toolbar
                    zoom
                    title="Peak Hours"
                  />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Peak hour', value: peak.hour >= 0 ? `${String(peak.hour).padStart(2, '0')}:00` : '—', icon: CalendarClock, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/20' },
                      { label: 'Orders in peak hour', value: fmtInt(peak.orders), icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20' },
                      { label: 'Revenue in peak hour', value: fmtCurrency(peak.revenue), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/20' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-700/50">
                        <div className={cn('mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg', s.bg)}>
                          <s.icon className={cn('h-3.5 w-3.5', s.color)} />
                        </div>
                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{s.value}</p>
                        <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyChart height={170} message="No orders in this period — hourly patterns will appear as orders come in." />
              )}
            </WidgetCard>
          );
        }

        case 'topCustomers':
          return (
            <WidgetCard id="topCustomers" title="Top Customers" description="Highest spenders this period" drag={drag}>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {(data.topCustomers || []).map((c, i) => (
                  <div key={`${c.email || c.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          i === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700'
                        )}
                      >
                        {i === 0 ? <Crown className="h-4 w-4" /> : i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-100">{c.name}</p>
                        <p className="truncate text-[11px] text-gray-500">{c.email || 'guest'}</p>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3 text-right">
                      <span className="text-[11px] text-gray-500">{fmtInt(c.orders)} orders</span>
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{fmtCurrency(c.spend)}</span>
                    </div>
                  </div>
                ))}
                {(data.topCustomers || []).length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-400">No customer spend yet.</p>
                )}
                <div className="pt-2">
                  <Link href="/admin/customers" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    View all customers <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </WidgetCard>
          );

        case 'delivery':
          return (
            <WidgetCard id="delivery" title="Delivery Performance" description="Fulfillment & shipping health" drag={drag}>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: 'Avg. fulfillment', value: fmtDuration(data.delivery.avgHours), sub: 'placed → delivered', icon: Hourglass, color: 'text-cyan-600' },
                  { label: 'Delivered', value: fmtInt(data.delivery.deliveredCount), sub: 'all time (timeline)', icon: Truck, color: 'text-green-600' },
                  { label: 'In transit', value: fmtInt(data.delivery.inTransit), sub: 'shipped / out for delivery', icon: Truck, color: 'text-blue-600' },
                  { label: 'To fulfill', value: fmtInt(data.delivery.toFulfill), sub: 'pending → packed', icon: Package, color: 'text-yellow-600' },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                      <s.icon className={cn('h-4 w-4', s.color)} />
                    </div>
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{s.value}</p>
                    <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{s.label} · {s.sub}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Link href="/admin/orders" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Manage orders <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </WidgetCard>
          );

        case 'refunds': {
          const byReason = data.refunds.byReason || [];
          return (
            <WidgetCard id="refunds" title="Refunds & Returns" description="Pending requests & reasons" drag={drag}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-rose-50 px-4 py-3 dark:bg-rose-900/20">
                  <p className="text-lg font-bold text-rose-700 dark:text-rose-300">{fmtInt(data.refunds.pending.count)}</p>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">Pending refund requests</p>
                </div>
                <div className="rounded-lg bg-red-50 px-4 py-3 dark:bg-red-900/20">
                  <p className="text-lg font-bold text-red-700 dark:text-red-300">{fmtCurrency(data.refunds.pending.amount)}</p>
                  <p className="text-[11px] text-red-600 dark:text-red-400">Amount awaiting action</p>
                </div>
              </div>
              {byReason.length > 0 ? (
                <div className="mt-4">
                  <h3 className="mb-3 text-xs font-semibold text-gray-700 dark:text-gray-200">Top request reasons</h3>
                  <HBarList
                    rows={byReason.map((r) => ({
                      label: r.reason,
                      value: r.count,
                      sub: fmtCurrency(r.amount),
                    }))}
                    format={fmtInt}
                    color="bg-rose-500"
                  />
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-gray-700">
                  No pending refunds — all clear ✅
                </p>
              )}
              <div className="mt-4">
                <Link href="/admin/orders?status=returned" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Review returns <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </WidgetCard>
          );
        }

        case 'compare': {
          const rev = data.charts.revenue;
          const ord = data.charts.orders;
          const units = data.charts.sales;
          const prev = data.charts.prevRevenue || [];
          const labels = rev.map((r) => shortDate(r._id));
          const aov = rev.map((r, i) => {
            const o = ord[i]?.count || 0;
            return o > 0 ? Math.round(((r.revenue || 0) / o) * 100) / 100 : 0;
          });
          return (
            <WidgetCard id="compare" title="Performance Explorer" description="Compare metrics side-by-side — brush to zoom, toggle view & overlay the previous period" drag={drag}>
              {labels.length === 0 ? (
                <EmptyChart height={240} message="No order data in this period yet." />
              ) : (
                <ComboChart
                  labels={labels}
                  series={{
                    revenue: rev.map((r) => r.revenue || 0),
                    orders: ord.map((o) => o.count || 0),
                    units: units.map((u) => u.units || 0),
                    aov,
                  }}
                  prev={prev.length ? prev.map((p) => p.revenue || 0) : null}
                  formatters={{
                    revenue: fmtCurrency,
                    orders: fmtInt,
                    units: fmtInt,
                    aov: fmtCurrency,
                  }}
                  title="Performance Explorer"
                />
              )}
            </WidgetCard>
          );
        }

        case 'heatmap':
          return (
            <WidgetCard id="heatmap" title="Activity Heatmap" description="Orders & revenue by weekday × hour — hover cells for details" drag={drag}>
              <HeatmapChart
                cells={data.heatmap || []}
                formatters={{ orders: fmtInt, revenue: fmtCurrency }}
                height={255}
                title="Activity Heatmap"
              />
            </WidgetCard>
          );

        case 'radar':
          return (
            <WidgetCard id="radar" title="Category Balance" description="How revenue & units spread across categories" drag={drag}>
              <RadarChart
                data={data.charts.categoryPerformance || []}
                formatters={{ revenue: fmtCurrency, units: fmtInt }}
                height={255}
                title="Category Balance"
              />
            </WidgetCard>
          );

        case 'gauges': {
          const o = data.overview;
          const st = data.ordersByStatus || {};
          const convPct = o.conversionRate ?? 0;
          const convGoal = 5;
          const convHealth = Math.min(100, (convPct / convGoal) * 100);
          const returning = Math.min(100, o.returningCustomerRate ?? 0);
          const totalOrd = o.totalOrders ?? 0;
          const delivered = st.delivered || 0;
          const fulfill = totalOrd > 0 ? Math.round((delivered / totalOrd) * 1000) / 10 : 0;
          const tracked = Math.max(0, (o.totalProducts ?? 0) - (o.lowStockProducts ?? 0) - (o.outOfStockProducts ?? 0));
          const stockHealth = o.totalProducts ? Math.round((tracked / o.totalProducts) * 100) : 0;
          return (
            <WidgetCard id="gauges" title="Health Gauges" description="Goal achievement & risk readouts" drag={drag}>
              <GaugeRow
                gauges={[
                  { label: `Conversion · ${convPct.toFixed(1)}% vs ${convGoal}% goal`, value: convHealth },
                  { label: `Returning customers · ${returning.toFixed(1)}%`, value: returning },
                  { label: `Fulfillment rate · ${fulfill.toFixed(1)}%`, value: fulfill },
                  { label: `Stock health · ${stockHealth}% in stock`, value: stockHealth },
                ]}
              />
            </WidgetCard>
          );
        }

        default:
          return null;
      }
    },
    [data, aiInsights, sparks, deltas, fmtCurrency, fmtInt, fmtPct, drag, toChartData, isEnabled]
  );

  const gridNodes = useMemo(() => {
    const nodes: ReactNode[] = [];
    for (const id of config.order) {
      if (isEnabled(id)) {
        nodes.push(
          <LazyMount key={id} className={cn('flex flex-col', WIDGET_META[id].span)}>
            <div>{renderWidget(id)}</div>
          </LazyMount>
        );
      }
    }
    return nodes;
  }, [config.order, isEnabled, renderWidget]);

  return <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-6">{gridNodes}</div>;
}

export const DashboardGrid = memo(DashboardGridImpl);
DashboardGrid.displayName = 'DashboardGrid';