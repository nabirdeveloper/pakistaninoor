'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Ban,
  Boxes,
  Clock,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Truck,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (mirror the route's GET response keys byte-for-byte)
// ---------------------------------------------------------------------------

interface ReorderSuggestion {
  productId: string;
  sku: string;
  name: string;
  slug: string;
  currentStock: number;
  lowStockThreshold: number;
  suggestedReorderQty: number;
  urgency: 'critical' | 'high' | 'medium';
  backorderAllowed: boolean;
}

interface OrderStatusAlert {
  orderId: string;
  orderNumber: string;
  status: string;
  stuckForHours: number;
  slaLimitHours: number;
  breached: boolean;
  recommendedAction: string;
  message: string;
  userId?: string;
}

interface AutomationBody {
  generated_at?: string;
  engine?: string;
  source?: string;
  summary?: {
    lowStock?: number;
    critical?: number;
    orderAlerts?: number;
    totalOrders?: number;
  };
  lowStock?: ReorderSuggestion[];
  orderAlerts?: OrderStatusAlert[];
  fire?: boolean;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function urgencyChip(urgency: string) {
  switch (urgency) {
    case 'critical':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    case 'high':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    default:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  }
}

function breachChip(breached: boolean) {
  return breached
    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
}

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------

export default function AdminAutomationPage() {
  const [data, setData] = useState<AutomationBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fire, setFire] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/automation${fire ? '?fire=1' : ''}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to run automations');
      }
      setData(await res.json());
    } catch (e: any) {
      setError(e?.message || 'Failed to run automations');
    } finally {
      setLoading(false);
    }
  }, [fire]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const lowStock = data?.lowStock ?? [];
  const orderAlerts = data?.orderAlerts ?? [];

  const stats = [
    {
      label: 'Tracked Low-Stock',
      value: summary?.lowStock ?? 0,
      icon: Boxes,
      accent: 'text-sky-600 dark:text-sky-400',
      chip: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    },
    {
      label: 'Critical Stock',
      value: summary?.critical ?? 0,
      icon: AlertTriangle,
      accent: 'text-red-600 dark:text-red-400',
      chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    },
    {
      label: 'Orders Scanned',
      value: summary?.totalOrders ?? 0,
      icon: PackageCheck,
      accent: 'text-emerald-600 dark:text-emerald-400',
      chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    },
    {
      label: 'Order Alerts',
      value: summary?.orderAlerts ?? 0,
      icon: Truck,
      accent: 'text-amber-600 dark:text-amber-400',
      chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Automation Runner
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Deterministic low-stock reorder + order-status SLA runner — always
            works, zero API keys, runs with the AI service down.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
              'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {data?.engine ?? 'rules'}
            {typeof data?.fire === 'boolean' ? (
              <span className="text-current/70">· fire={data.fire ? 'on' : 'off'}</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={fire}
            onChange={(e) => setFire(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500 dark:border-gray-700 dark:bg-gray-900"
          />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            fire=1 (also push in-app notifications)
          </span>
        </label>
        {data?.generated_at ? (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            generated {data.generated_at}
          </span>
        ) : null}
      </div>

      {/* summary chips */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between">
              <stat.icon className={cn('h-5 w-5', stat.accent)} />
              <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', stat.chip)}>
                {stat.label}
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">
              {loading ? '—' : stat.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* low-stock reorder table */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-sky-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Low-Stock Reorder
            </h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {lowStock.length}
            </span>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {data?.source ?? 'automation:rules'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:text-gray-500">
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Current Stock</th>
                <th className="px-4 py-3 font-medium">Threshold</th>
                <th className="px-4 py-3 font-medium">Reorder Qty</th>
                <th className="px-4 py-3 font-medium">Urgency</th>
                <th className="px-4 py-3 font-medium">Backorder</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : lowStock.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                    No tracked products at or below their low-stock threshold.
                  </td>
                </tr>
              ) : (
                lowStock.map((item) => (
                  <tr
                    key={item.productId}
                    className="border-b border-gray-50 transition hover:bg-gray-50 dark:border-gray-800/60 dark:hover:bg-gray-800/40"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {item.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'font-semibold',
                          item.currentStock === 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-700 dark:text-gray-200'
                        )}
                      >
                        {item.currentStock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {item.lowStockThreshold}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                      {item.suggestedReorderQty}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          urgencyChip(item.urgency)
                        )}
                      >
                        {item.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.backorderAllowed ? (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Allowed
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* order-status SLA alert table */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Order-Status Alerts
            </h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {orderAlerts.length}
            </span>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            SLA
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-400 dark:border-gray-800 dark:text-gray-500">
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Stuck (h)</th>
                <th className="px-4 py-3 font-medium">SLA (h)</th>
                <th className="px-4 py-3 font-medium">Breached</th>
                <th className="px-4 py-3 font-medium">Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : orderAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400 dark:text-gray-500">
                    No in-flight orders stuck past their SLA window.
                  </td>
                </tr>
              ) : (
                orderAlerts.map((alert) => (
                  <tr
                    key={alert.orderId}
                    className="border-b border-gray-50 transition hover:bg-gray-50 dark:border-gray-800/60 dark:hover:bg-gray-800/40"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      {alert.orderNumber}
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-700 dark:text-gray-200">
                      {alert.status.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                      {alert.stuckForHours}h
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {alert.slaLimitHours}h
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          breachChip(alert.breached)
                        )}
                      >
                        {alert.breached ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                      {alert.recommendedAction}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {error ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
        >
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4" />
            {error}
          </div>
        </motion.div>
      ) : null}

      <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        Deterministic rules engine · works with the AI service down · source{' '}
        {data?.source ?? 'automation:rules'}
      </p>
    </main>
  );
}