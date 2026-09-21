'use client';

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Users,
  AlertTriangle,
  HeartCrack,
  Crown,
  Wallet,
  RefreshCw,
  Sparkles,
  Mail,
  Smartphone,
  Send,
  Flame,
  TrendingDown,
  Copy,
  Check,
  Loader2,
  Search,
  BadgePercent,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CustomerSegment =
  | 'vip'
  | 'high_value'
  | 'active'
  | 'at_risk'
  | 'churned'
  | 'new'
  | 'one_time';

type ActionChannel = 'email' | 'push' | 'sms';

interface CustomerRow {
  userId: string;
  name: string;
  email: string;
  image?: string;
  totalSpend: number;
  orderCount: number;
  avgOrderValue: number;
  daysSinceLastOrder: number | null;
  churnScore: number;
  segment: CustomerSegment;
  suggestedAction: string;
  actionChannel: ActionChannel;
  winbackMessage: string;
}

interface SegmentMeta {
  segment: CustomerSegment;
  label: string;
  chip: string;
  count: number;
  totalValue: number;
}

interface CustomerIntelligenceResult {
  generatedAt: string;
  source?: string;
  engine?: string;
  summary: {
    totalCustomers: number;
    atRiskCustomers: number;
    churnedCustomers: number;
    vipCustomers: number;
    atRiskValue: number;
    totalValue: number;
  };
  segments: SegmentMeta[];
  customers: CustomerRow[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEGMENT_META: Record<CustomerSegment, { label: string; chip: string }> = {
  vip: {
    label: 'VIP',
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  },
  high_value: {
    label: 'High value',
    chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  active: {
    label: 'Active',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  at_risk: {
    label: 'At risk',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  churned: {
    label: 'Churned',
    chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  new: {
    label: 'New',
    chip: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  },
  one_time: {
    label: 'One-time',
    chip: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  },
};

const CHANNEL_ICON: Record<ActionChannel, typeof Mail> = {
  email: Mail,
  push: Send,
  sms: Smartphone,
};

const CHANNEL_LABEL: Record<ActionChannel, string> = {
  email: 'Email',
  push: 'Push',
  sms: 'SMS',
};

function churnColor(score: number) {
  if (score >= 70) return 'bg-red-500';
  if (score >= 40) return 'bg-amber-500';
  if (score >= 20) return 'bg-yellow-400';
  return 'bg-emerald-500';
}

const SEG_ORDER: CustomerSegment[] = [
  'at_risk',
  'churned',
  'vip',
  'high_value',
  'active',
  'new',
  'one_time',
];

export default function AdminCustomerIntelligencePage() {
  const [data, setData] = useState<CustomerIntelligenceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CustomerSegment | 'all'>('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/customer-intelligence');
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Failed to load customer intelligence.');
        return;
      }
      setData(result);
    } catch {
      setError('Network error while loading customer intelligence.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const customers = useMemo(() => {
    if (!data) return [];
    let list = data.customers.slice();
    if (filter !== 'all') list = list.filter((c) => c.segment === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => b.churnScore - a.churnScore);
    return list;
  }, [data, filter, search]);

  const summary = data?.summary;

  const stats = [
    {
      key: 'total',
      label: 'Customers',
      value: summary?.totalCustomers,
      icon: Users,
      color: 'text-gray-500',
    },
    {
      key: 'atRisk',
      label: 'At risk',
      value: summary?.atRiskCustomers,
      icon: AlertTriangle,
      color: 'text-amber-500',
    },
    {
      key: 'churned',
      label: 'Churned',
      value: summary?.churnedCustomers,
      icon: HeartCrack,
      color: 'text-red-500',
    },
    {
      key: 'vip',
      label: 'VIP',
      value: summary?.vipCustomers,
      icon: Crown,
      color: 'text-violet-500',
    },
    {
      key: 'atRiskValue',
      label: 'At-risk value',
      value: summary ? `৳${summary.atRiskValue.toLocaleString('en-IN')}` : undefined,
      icon: Wallet,
      color: 'text-amber-500',
    },
    {
      key: 'totalValue',
      label: 'Total value',
      value: summary ? `৳${summary.totalValue.toLocaleString('en-IN')}` : undefined,
      icon: TrendingDown,
      color: 'text-emerald-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Customer Intelligence
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Churn risk scoring and retention segmentation derived from your order history — with a
            suggested win-back action for every customer.
          </p>
        </div>
        {data?.source === 'ai_service' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            {data.engine === 'template' ? 'Local engine' : 'AI service'}
          </span>
        )}
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.key}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <s.icon className={cn('h-5 w-5', s.color)} />
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {s.value ?? '—'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-medium',
            filter === 'all'
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          )}
        >
          All
        </button>
        {SEG_ORDER.filter((s) =>
          data?.segments.some((seg) => seg.segment === s && seg.count > 0)
        ).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium',
              filter === s
                ? cn('text-white', cn(SEGMENT_META[s].chip, 'text-white') || 'bg-primary')
                : cn(
                    'bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700',
                    SEGMENT_META[s].chip
                  )
            )}
          >
            {SEGMENT_META[s].label}{' '}
            ({data?.segments.find((seg) => seg.segment === s)?.count ?? 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
        <Search className="h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers…"
          className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="h-3.5 w-1/4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="mt-3 h-2.5 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
          <Users className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Add enough paid orders and this dashboard will segment your customers by value, churn
            risk and retention potential.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map((c) => {
            const meta = SEGMENT_META[c.segment];
            const ChannelIcon = CHANNEL_ICON[c.actionChannel];
            return (
              <div
                key={c.userId}
                className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                      <span
                        className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', meta.chip)}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-400">{c.email}</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      ৳{c.totalSpend.toLocaleString('en-IN')} · {c.orderCount} orders · avg
                      ৳{c.avgOrderValue.toLocaleString('en-IN')}
                      {c.daysSinceLastOrder !== null &&
                        ` · ${c.daysSinceLastOrder}d since last order`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary">
                      <ChannelIcon className="h-3.5 w-3.5" /> {CHANNEL_LABEL[c.actionChannel]}
                    </span>
                    <span className="text-[11px] font-medium text-gray-400">Churn</span>
                    <div className="h-2 w-20 rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className={cn('h-2 rounded-full', churnColor(c.churnScore))}
                        style={{ width: `${c.churnScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      {c.churnScore}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                  {c.suggestedAction}
                </p>
                <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs italic text-gray-500 dark:bg-gray-700/50 dark:text-gray-400">
                  “{c.winbackMessage}”
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}