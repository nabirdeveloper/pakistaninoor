'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  PackageX,
  TrendingUp,
  Megaphone,
  Beaker,
  AlertTriangle,
  Clock,
  Wallet,
  Percent,
  ArrowRight,
  Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Urgency = 'critical' | 'low' | 'ok' | 'stale';
type SlowStatus = 'slow' | 'dead';
type PromoReason = 'stock_pressure' | 'margin_clearance' | 'low_velocity';

interface ReorderSuggestion {
  productId: string;
  name: string;
  slug?: string;
  category?: string;
  currentStock: number;
  avgDailySales: number;
  daysOfCover: number;
  targetCoverDays: number;
  suggestedOrderQty: number;
  urgency: Urgency;
}

interface SlowMover {
  productId: string;
  name: string;
  slug?: string;
  category?: string;
  currentStock: number;
  unitsSold90d: number;
  daysOfCover: number;
  lockedValue: number;
  status: SlowStatus;
}

interface PromoIdea {
  productId: string;
  name: string;
  slug?: string;
  category?: string;
  price: number;
  compareAtPrice?: number;
  currentStock: number;
  daysOfCover: number;
  estimatedMarginPct: number;
  suggestedDiscountPct: number;
  suggestedPrice: number;
  reason: PromoReason;
}

interface MerchandisingData {
  generatedAt: string;
  reorderSuggestions: ReorderSuggestion[];
  slowMovers: SlowMover[];
  promoIdeas: PromoIdea[];
  summary: {
    criticalRestockProducts: number;
    deadStockProducts: number;
    promoPotentialProducts: number;
    lockedInventoryValue: number;
  };
  source?: string;
}

const URGENCY_STYLES: Record<Urgency, { label: string; className: string }> = {
  critical: {
    label: 'Restock now',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  low: {
    label: 'Order soon',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  ok: {
    label: 'Comfortable',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  stale: {
    label: 'Stale — no demand',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  },
};

const REASON_LABELS: Record<PromoReason, string> = {
  stock_pressure: 'Stock pressure — clear excess inventory',
  margin_clearance: 'Dead stock — clear at a safe margin',
  low_velocity: 'Low velocity — stimulate demand',
};

type Tab = 'reorder' | 'slow' | 'promo';

export default function AdminAiMerchandisingPage() {
  const [data, setData] = useState<MerchandisingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('reorder');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/ai-merchandising');
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to load merchandising intelligence');
        return;
      }
      setData(result);
    } catch {
      setError('Network error while loading merchandising intelligence.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tabs: Array<{ id: Tab; label: string; icon: typeof Beaker; count?: number }> = [
    { id: 'reorder', label: 'Reorder Intelligence', icon: TrendingUp, count: data?.reorderSuggestions.length },
    { id: 'slow', label: 'Slow Movers', icon: PackageX, count: data?.slowMovers.length },
    { id: 'promo', label: 'Promo Ideas', icon: Megaphone, count: data?.promoIdeas.length },
  ];

  const coverText = (days: number) => (days >= 999 ? '∞' : `${days}d`);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            AI Merchandising &amp; Inventory Intelligence
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Demand velocity × stock cover across the last 90 days — what to reorder, what is
            dead stock, and which SKUs should go on promo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.source && (
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              <Beaker className="mr-1 inline h-3 w-3" />
              {data.source === 'ai_service' ? 'AI service' : 'Local engine'}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Critical restock</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {data?.summary.criticalRestockProducts ?? '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <PackageX className="h-5 w-5 text-amber-500" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Dead stock SKUs</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {data?.summary.deadStockProducts ?? '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <Megaphone className="h-5 w-5 text-violet-500" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Promo candidates</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {data?.summary.promoPotentialProducts ?? '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <Wallet className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Inventory locked value</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              ৳{(data?.summary.lockedInventoryValue ?? 0).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === t.id
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {typeof t.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  tab === t.id
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {data?.generatedAt && (
        <p className="text-xs text-gray-400">
          Generated {new Date(data.generatedAt).toLocaleString()} · 90-day lookback
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="mt-3 h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {tab === 'reorder' && (
            <ReorderTab key="reorder" items={data?.reorderSuggestions ?? []} coverText={coverText} />
          )}
          {tab === 'slow' && (
            <SlowTab key="slow" items={data?.slowMovers ?? []} coverText={coverText} />
          )}
          {tab === 'promo' && (
            <PromoTab key="promo" items={data?.promoIdeas ?? []} coverText={coverText} />
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Beaker; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
      <Icon className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{text}</p>
    </div>
  );
}

function ReorderTab({
  items,
  coverText,
}: {
  items: ReorderSuggestion[];
  coverText: (d: number) => string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        text="No products need reordering right now. Every tracked item has enough cover at current demand."
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((r) => {
        const style = URGENCY_STYLES[r.urgency];
        return (
          <motion.div
            key={r.productId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {r.name}
                  </span>
                  {r.category && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                      {r.category}
                    </span>
                  )}
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                      style.className
                    )}
                  >
                    {r.urgency === 'critical' && <AlertTriangle className="h-3 w-3" />}
                    {style.label}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="Current stock" value={String(r.currentStock)} />
                  <Metric label="Avg sales / day" value={String(r.avgDailySales)} />
                  <Metric label="Days of cover" value={coverText(r.daysOfCover)} />
                  <Metric
                    label={
                      r.urgency === 'stale'
                        ? 'Reorder qty'
                        : `Order to ${r.targetCoverDays}d cover`
                    }
                    value={r.urgency === 'stale' ? '0' : String(r.suggestedOrderQty)}
                    highlight={r.urgency !== 'stale' && r.suggestedOrderQty > 0}
                  />
                </div>
              </div>
              {r.slug && (
                <Link
                  href={`/admin/products/${r.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Box className="h-3.5 w-3.5" /> Edit product
                </Link>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function SlowTab({
  items,
  coverText,
}: {
  items: SlowMover[];
  coverText: (d: number) => string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={PackageX}
        text="No slow movers or dead stock. Inventory is turning over healthily."
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((s) => (
        <motion.div
          key={s.productId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">{s.name}</span>
                {s.category && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                    {s.category}
                  </span>
                )}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    s.status === 'dead'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  )}
                >
                  {s.status === 'dead' ? 'Dead stock' : 'Slow mover'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Stock on hand" value={String(s.currentStock)} />
                <Metric label="Sold (90d)" value={String(s.unitsSold90d)} />
                <Metric label="Days of cover" value={coverText(s.daysOfCover)} />
                <Metric
                  label="Locked value"
                  value={`৳${s.lockedValue.toLocaleString('en-IN')}`}
                  highlight
                />
              </div>
              {s.status === 'dead' && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="h-3.5 w-3.5" />
                  Zero units sold in 90 days — consider a clearance promo or donation write-off.
                </p>
              )}
            </div>
            {s.slug && (
              <Link
                href={`/admin/products/${s.slug}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Box className="h-3.5 w-3.5" /> Edit product
              </Link>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function PromoTab({
  items,
  coverText,
}: {
  items: PromoIdea[];
  coverText: (d: number) => string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        text="No promo candidates right now. Products with excess inventory and enough margin to discount will show up here."
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((p) => (
        <motion.div
          key={p.productId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
                {p.category && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                    {p.category}
                  </span>
                )}
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  {REASON_LABELS[p.reason]}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    ৳{p.suggestedPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-sm text-gray-400 line-through">
                    ৳{p.price.toLocaleString('en-IN')}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
                    <Percent className="h-3 w-3" /> {p.suggestedDiscountPct}% off
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Est. margin" value={`${p.estimatedMarginPct}%`} />
                <Metric label="Days of cover" value={coverText(p.daysOfCover)} />
                <Metric label="Stock on hand" value={String(p.currentStock)} />
                <Metric
                  label="Discounted price"
                  value={`৳${p.suggestedPrice.toLocaleString('en-IN')}`}
                  highlight
                />
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Suggested discount is capped to keep ~55% of current margin.
              </p>
            </div>
            {p.slug && (
              <Link
                href={`/admin/products/${p.slug}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Set price <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-900/60">
      <p className="text-[11px] text-gray-400 dark:text-gray-500">{label}</p>
      <p
        className={cn(
          'text-sm font-semibold',
          highlight ? 'text-primary' : 'text-gray-800 dark:text-gray-200'
        )}
      >
        {value}
      </p>
    </div>
  );
}