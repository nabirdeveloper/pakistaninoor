'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { Download, Eye, LayoutDashboard, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import {
  ALL_WIDGETS,
  CURRENCIES,
  kpiCards,
  statusColors,
  STORAGE_KEY,
  timeAgo,
  WIDGET_META,
  type AiInsights,
  type CurrencyCode,
  type DashConfig,
  type DashboardData,
  type OverviewKey,
  type WidgetId,
} from '@/components/admin/dashboard/dashboard-shared';

// The chart-heavy widget grid lives in its own chunk (ApexCharts + ECharts),
// so the dashboard shell above stays small and paints first.
const DashboardGrid = dynamic(
  () => import('@/components/admin/dashboard/dashboard-grid').then((m) => m.DashboardGrid),
  { ssr: false, loading: () => <GridSkeleton /> }
);

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-6" role="status" aria-label="Loading dashboard">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800',
            i < 2 ? 'xl:col-span-6' : i % 3 === 0 ? 'xl:col-span-3' : 'xl:col-span-2'
          )}
        >
          <div className="h-4 w-2/5 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-4 h-40 rounded bg-gray-100 dark:bg-gray-700/60" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

function loadConfig(): DashConfig {
  if (typeof window === 'undefined') {
    return { order: ALL_WIDGETS, disabled: {}, currency: 'BDT', autoRefresh: true };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const order: WidgetId[] = Array.isArray(parsed.order)
        ? parsed.order.filter((id: string) => ALL_WIDGETS.includes(id as WidgetId))
        : ALL_WIDGETS;
      ALL_WIDGETS.forEach((id) => {
        if (!order.includes(id)) order.push(id);
      });
      return {
        order,
        disabled: parsed.disabled || {},
        currency: CURRENCIES[parsed.currency as CurrencyCode] ? parsed.currency : 'BDT',
        autoRefresh: parsed.autoRefresh !== false,
      };
    }
  } catch {
    // fall through to defaults
  }
  return { order: ALL_WIDGETS, disabled: {}, currency: 'BDT', autoRefresh: true };
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

const downloadFile = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

function ToggleSwitch({
  enabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors',
        enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
      )}
      aria-label={`${enabled ? 'Disable' : 'Enable'} ${label}`}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          enabled ? 'left-[22px]' : 'left-0.5'
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [config, setConfig] = useState<DashConfig>(loadConfig);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const currency = CURRENCIES[config.currency];

  const fmtCurrency = useCallback(
    (n: number) =>
      `${currency.symbol}${(n * currency.rate).toLocaleString(undefined, {
        maximumFractionDigits: currency.decimals,
      })}`,
    [currency]
  );
  const fmtInt = useCallback((n: number) => n.toLocaleString(), []);
  const fmtPct = useCallback((n: number) => `${n}%`, []);

  const queryKey = useMemo(() => {
    if (period === 'custom' && customStart && customEnd) {
      return `start=${encodeURIComponent(customStart)}&end=${encodeURIComponent(customEnd)}`;
    }
    return `days=${period}`;
  }, [period, customStart, customEnd]);

  /**
   * Fetches the dashboard payload and — in parallel — the AI insights.
   * The dashboard renders as soon as IT arrives; a slow AI service never
   * blocks the page. AI insights are applied whenever they land.
   *
   * `refreshAi` is off for the 60s auto-refresh so we don't hammer the AI
   * service every minute — only initial load and manual refresh pull it.
   */
  const abortRef = useRef<AbortController | null>(null);
  const fetchData = useCallback(
    async (quiet = false, refreshAi = true) => {
      // Supersede any in-flight request (e.g. fast period switching) — the
      // newest request owns the UI; stale ones are cancelled, not applied.
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const { signal } = ac;

      if (!quiet) setLoading(true);
      setError('');

      if (refreshAi) {
        const periodParam = queryKey.includes('days') ? queryKey.split('=')[1] : '30';
        const aiPromise = fetch(`/api/admin/ai-insights?period=${periodParam}`, {
          cache: 'no-store',
          signal,
        })
          .then((r) => r.json())
          .catch(() => null);
        void aiPromise.then((ai) => {
          if (ai && typeof ai === 'object' && !(ai as { error?: unknown }).error) {
            setAiInsights(ai as AiInsights);
          }
        });
      }

      try {
        const dashRes = await fetch(`/api/admin/dashboard?${queryKey}`, {
          cache: 'no-store',
          signal,
        });
        const dash = (await dashRes.json()) as DashboardData & { error?: string };
        if (!dashRes.ok) throw new Error(dash.error || 'Failed to load dashboard');
        setData(dash);
        setLastUpdated(new Date());
      } catch (e) {
        // Aborted = superseded by a newer request; the newer one owns the UI.
        if ((e as Error)?.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        if (!quiet && abortRef.current === ac) setLoading(false);
      }
    },
    [queryKey]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Start downloading the chart-heavy grid chunk while the dashboard API is
  // still in flight, so charts are ready (or already parsed) when data lands.
  useEffect(() => {
    void import('@/components/admin/dashboard/dashboard-grid');
  }, []);

  // Auto refresh every 60s while the tab is visible (dashboard data only —
  // AI insights are skipped to avoid hammering the AI service every minute).
  useEffect(() => {
    if (!config.autoRefresh) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData(true, false);
    }, 60000);
    return () => clearInterval(t);
  }, [config.autoRefresh, fetchData]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // storage unavailable — personal dashboard simply won't persist
    }
  }, [config]);

  // Close the export menu when clicking/tapping outside it.
  useEffect(() => {
    if (!showExport) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [showExport]);

  const toggleWidget = (id: WidgetId | OverviewKey) => {
    setConfig((prev) => {
      const disabled = { ...prev.disabled };
      if (disabled[id]) delete disabled[id];
      else disabled[id] = true;
      return { ...prev, disabled };
    });
  };

  const resetLayout = () => {
    setConfig({ order: ALL_WIDGETS, disabled: {}, currency: 'BDT', autoRefresh: true });
    setPeriod('30');
  };

  /** Drag-drop reorder applied by the grid (ordering data lives here). */
  const onReorder = useCallback((from: string, targetId: string) => {
    setConfig((prev) => {
      const order = prev.order.filter((id) => id !== from);
      const idx = order.indexOf(targetId as WidgetId);
      if (idx >= 0) order.splice(idx, 0, from as WidgetId);
      return { ...prev, order };
    });
  }, []);

  const isEnabled = (id: WidgetId | OverviewKey) => !config.disabled[id];

  const exportCSV = () => {
    if (!data) return;
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines: (string | number | undefined)[][] = [
      ['Pakistan Noor — Dashboard Export'],
      [`Range`, `${new Date(data.range.from).toLocaleDateString()} — ${new Date(data.range.to).toLocaleDateString()}`],
      [`Exported at`, new Date().toLocaleString()],
      [''],
      ['Metric', 'Value'],
      ['Total Sales (units)', data.overview.totalSales],
      ['Total Orders', data.overview.totalOrders],
      ['Total Customers', data.overview.totalCustomers],
      ['Total Products', data.overview.totalProducts],
      ['Total Revenue (BDT)', data.overview.totalRevenue],
      ['Net Revenue (BDT)', data.overview.netRevenue],
      ['Gross Profit (BDT)', data.overview.grossProfit],
      ['Average Order Value (BDT)', data.overview.averageOrderValue],
      ['Conversion Rate (%)', data.overview.conversionRate],
      ['Returning Customer Rate (%)', data.overview.returningCustomerRate],
      ['Refund Amount (BDT)', data.overview.refundAmount],
      ['Cancelled Orders', data.overview.cancelledOrders],
      ['Pending Orders', data.overview.pendingOrders],
      ['Low Stock Products', data.overview.lowStockProducts],
      ['Out of Stock Products', data.overview.outOfStockProducts],
      [''],
      ['Live Widgets', ''],
      ['Orders (24h)', data.live.liveOrders],
      ['Visitors (30 min)', data.live.liveVisitors],
      ['Active Carts', data.live.liveCheckout],
      ['Revenue Today (BDT)', data.live.liveRevenue],
      ['Open Support Tickets', data.live.supportTickets.open],
      ['Payment Alerts', data.live.paymentAlerts.count],
      ['Fraud Alerts', data.live.fraudAlerts.count],
      [''],
      ['Comparison vs Previous Period', ''],
      ['Metric', 'Current', 'Previous', 'Change %'],
      ['Revenue', data.overview.totalRevenue, data.comparison.prevRevenue, data.comparison.prevRevenue > 0 ? `${(((data.overview.totalRevenue - data.comparison.prevRevenue) / data.comparison.prevRevenue) * 100).toFixed(1)}%` : ''],
      ['Orders', data.overview.totalOrders, data.comparison.prevOrders, data.comparison.prevOrders > 0 ? `${(((data.overview.totalOrders - data.comparison.prevOrders) / data.comparison.prevOrders) * 100).toFixed(1)}%` : ''],
      ['Units Sold', data.overview.totalSales, data.comparison.prevUnits, data.comparison.prevUnits > 0 ? `${(((data.overview.totalSales - data.comparison.prevUnits) / data.comparison.prevUnits) * 100).toFixed(1)}%` : ''],
      ['New Customers', data.overview.totalCustomers, data.comparison.prevCustomers, data.comparison.prevCustomers > 0 ? `${(((data.overview.totalCustomers - data.comparison.prevCustomers) / data.comparison.prevCustomers) * 100).toFixed(1)}%` : ''],
      ['', ''],
      ['Revenue By Day', ''],
      ['Date', 'Revenue', 'Orders'],
      ...data.charts.revenue.map((r) => [r._id, r.revenue, r.orders]),
      [''],
      ['Sales By Day (units)', ''],
      ['Date', 'Units'],
      ...data.charts.sales.map((r) => [r._id, r.units]),
      [''],
      ['Orders By Day', ''],
      ['Date', 'Orders'],
      ...data.charts.orders.map((r) => [r._id, r.count]),
      [''],
      ['Customer Growth By Day', ''],
      ['Date', 'Customers'],
      ...data.charts.customerGrowth.map((r) => [r._id, r.count]),
      [''],
      ['Top Products', ''],
      ['Name', 'Units', 'Revenue (BDT)'],
      ...data.charts.productPerformance.map((p) => [p.name, p.units, p.revenue]),
      [''],
      ['Category Performance', ''],
      ['Category', 'Units', 'Revenue (BDT)'],
      ...data.charts.categoryPerformance.map((c) => [c.name, c.units, c.revenue]),
      [''],
      ['Payment Methods', ''],
      ['Method', 'Orders', 'Revenue (BDT)'],
      ...data.charts.paymentMethods.map((p) => [p.method, p.orders, p.revenue]),
      [''],
      ['Geographic Sales', ''],
      ['City', 'Orders', 'Revenue (BDT)'],
      ...data.charts.geography.map((g) => [g.city, g.orders, g.revenue]),
      [''],
      ['Inventory Snapshot', ''],
      ['Units in Stock', data.inventory.units],
      ['Value at Cost (BDT)', data.inventory.costValue],
      ['Value at Retail (BDT)', data.inventory.retailValue],
      ['Potential Profit (BDT)', data.inventory.potentialProfit],
      [''],
      ['Inventory By Category', ''],
      ['Category', 'Units', 'Retail Value (BDT)'],
      ...data.inventory.byCategory.map((c) => [c.name, c.units, c.retailValue]),
      [''],
      ['Promotions', ''],
      ['Coupon Orders', data.promos.couponOrders],
      ['Total Discount Given (BDT)', data.promos.totalDiscount],
      ['Coupon Revenue (BDT)', data.promos.couponRevenue],
      [''],
      ['Top Coupons', ''],
      ['Code', 'Orders', 'Discount (BDT)', 'Revenue (BDT)'],
      ...data.promos.byCoupon.map((c) => [c.code, c.orders, c.discount, c.revenue]),
      [''],
      ['Peak hours (Orders by Hour)', ''],
      ['Hour', 'Orders', 'Revenue (BDT)'],
      ...data.hourly.map((h) => [`${String(h.hour).padStart(2, '0')}:00`, h.orders, h.revenue]),
      [''],
      ['Top Customers', ''],
      ['Name', 'Email', 'Orders', 'Spend (BDT)'],
      ...data.topCustomers.map((c) => [c.name, c.email, c.orders, c.spend]),
      [''],
      ['Delivery Performance', ''],
      ['Avg Fulfillment Time (hours)', data.delivery.avgHours],
      ['Delivered (all-time)', data.delivery.deliveredCount],
      ['In Transit', data.delivery.inTransit],
      ['To Fulfill', data.delivery.toFulfill],
      [''],
      ['Refunds & Returns', ''],
      ['Pending Requests', data.refunds.pending.count],
      ['Pending Amount (BDT)', data.refunds.pending.amount],
      [''],
      ['Refund Reasons', ''],
      ['Reason', 'Count', 'Amount (BDT)'],
      ...data.refunds.byReason.map((r) => [r.reason, r.count, r.amount]),
    ];
    downloadFile('dashboard-export.csv', lines.map((l) => l.map(esc).join(',')).join('\n'), 'text/csv');
  };

  const exportJSON = () => {
    if (!data) return;
    downloadFile('dashboard-export.json', JSON.stringify({ ...data, aiInsights }, null, 2), 'application/json');
  };

  const exportPrint = () => {
    window.print();
  };

  // ── Customize modal ─────────────────────────────────────────────────────
  const customizeModal = (
    <AnimatePresence>
      {showCustomize && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowCustomize(false)}
        >
          <motion.div
            initial={{ scale: 0.96, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 10 }}
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Customize Dashboard</h2>
                <p className="text-sm text-gray-500">Personal layout — saved to this browser. Drag cards to reorder them on the page.</p>
              </div>
              <button onClick={() => setShowCustomize(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Overview metrics
              </p>
              {kpiCards.map((card) => (
                <div key={card.key} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{card.label}</p>
                    <p className="truncate text-[11px] text-gray-400">{card.sub || 'Headline metric'}</p>
                  </div>
                  <ToggleSwitch
                    enabled={isEnabled(card.key)}
                    onToggle={() => toggleWidget(card.key)}
                    label={card.label}
                  />
                </div>
              ))}
              <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Widgets
              </p>
              {ALL_WIDGETS.map((id) => (
                <div key={id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{WIDGET_META[id].title}</p>
                    <p className="text-[11px] text-gray-400">{WIDGET_META[id].description}</p>
                  </div>
                  <ToggleSwitch
                    enabled={isEnabled(id)}
                    onToggle={() => toggleWidget(id)}
                    label={WIDGET_META[id].title}
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700">
              <button
                onClick={resetLayout}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Reset layout
              </button>
              <button
                onClick={() => setShowCustomize(false)}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Export dropdown ─────────────────────────────────────────────────────
  const exportMenu = (
    <div className="relative" ref={exportRef}>
      <button
        onClick={() => setShowExport((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <Download className="h-4 w-4" /> Export
      </button>
      <AnimatePresence>
        {showExport && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute right-0 z-30 mt-1.5 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            <button onClick={() => { exportCSV(); setShowExport(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">
              <Download className="h-4 w-4 text-gray-400" /> CSV
            </button>
            <button onClick={() => { exportJSON(); setShowExport(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">
              <Download className="h-4 w-4 text-gray-400" /> JSON
            </button>
            <button onClick={() => { exportPrint(); setShowExport(false); }} className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">
              <Eye className="h-4 w-4 text-gray-400" /> Print / PDF
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // ── Order status strip ─────────────────────────────────────────────────
  const orderSummary = Object.entries(data?.ordersByStatus || {});

  return (
    <div className="space-y-6">
      {/* ── Header / filters ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10">
            <LayoutDashboard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Welcome back! Here&apos;s what&apos;s happening with your store.
              {lastUpdated && <span className="ml-1 text-xs text-gray-400">· updated {timeAgo(lastUpdated)}</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range */}
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
            {(['7', '30', '90', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  period === p
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                {p === 'custom' ? 'Custom' : `${p}d`}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <span className="text-xs text-gray-400">→</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
          )}

          {/* Store filter */}
          <select
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            defaultValue="all"
            title="Store filter"
          >
            <option value="all">All stores</option>
            <option value="noor">Pakistani Noor</option>
          </select>

          {/* Currency filter */}
          <select
            value={config.currency}
            onChange={(e) => setConfig((prev) => ({ ...prev, currency: e.target.value as CurrencyCode }))}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            title="Currency filter"
          >
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
              <option key={c} value={c}>
                {CURRENCIES[c].symbol} {c}
              </option>
            ))}
          </select>

          {/* Auto-refresh */}
          <button
            onClick={() => setConfig((prev) => ({ ...prev, autoRefresh: !prev.autoRefresh }))}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors',
              config.autoRefresh
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
                : 'border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-800'
            )}
            title="When enabled, live widgets refresh every 60 seconds"
          >
            <span className={cn('h-2 w-2 rounded-full', config.autoRefresh ? 'animate-pulse bg-green-500' : 'bg-gray-300')} />
            Auto
          </button>

          <button
            onClick={() => fetchData(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>

          {exportMenu}

          <button
            onClick={() => setShowCustomize(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Customize
          </button>
        </div>
      </div>

      {/* ── Order status strip ───────────────────────────────────────────── */}
      {orderSummary.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {orderSummary.map(([status, count]) => (
            <span key={status} className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium capitalize', statusColors[status] || 'bg-gray-100 text-gray-600')}>
              {count} {status.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {data ? (
        <DashboardGrid
          data={data}
          aiInsights={aiInsights}
          fmtCurrency={fmtCurrency}
          fmtInt={fmtInt}
          fmtPct={fmtPct}
          config={config}
          onReorder={onReorder}
        />
      ) : (
        <GridSkeleton />
      )}

      {customizeModal}

      {/* Print-only attribution */}
      <div className="hidden print:block text-xs text-gray-400">
        Pakistan Noor · Dashboard export · {new Date().toLocaleString()}
      </div>
    </div>
  );
}