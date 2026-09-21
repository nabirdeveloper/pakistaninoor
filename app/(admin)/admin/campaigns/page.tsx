'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Megaphone,
  Search,
  RefreshCw,
  Save,
  Loader2,
  Check,
  X,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CampaignCoupon {
  _id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  isActive: boolean;
  usedCount: number;
  usage: number;
  startDate?: string;
  endDate?: string;
}

interface CampaignGroup {
  name: string;
  coupons: CampaignCoupon[];
  couponCount: number;
  usedCount: number;
  discountAmount: number;
  activeCount: number;
}

interface CampaignsData {
  groups: CampaignGroup[];
  totalCampaigns: number;
  totalCoupons: number;
}

export default function CampaignsPage() {
  const [data, setData] = useState<CampaignsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [editing, setEditing] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/admin/campaigns?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load campaigns');
      setData(json);
    } catch (error: any) {
      console.error(error);
      setMessage(`⚠️ ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const assignCampaign = async (couponId: string, campaign: string) => {
    setBusyId(couponId);
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: campaign.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update coupon');
      setEditing((e) => {
        const next = { ...e };
        delete next[couponId];
        return next;
      });
      await load();
    } catch (error: any) {
      setMessage(`⚠️ ${error.message}`);
    } finally {
      setBusyId('');
    }
  };

  const typeLabel = (type: string) => type.replace('_', ' ');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Campaigns
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Group coupons into marketing campaigns and track their performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search codes or campaigns…"
              className="w-64 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={load}
            className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <Megaphone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Campaigns
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {data.totalCampaigns}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20">
                <Tag className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Coupons
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {data.totalCoupons}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/20">
                <Check className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Total Redemptions
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {(data.groups || []).reduce(
                    (sum, g) => sum + g.usedCount,
                    0
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {message}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-20 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {!data?.groups || data.groups.length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-16 text-center">
              <Megaphone className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                No coupons yet. Create coupons in the{' '}
                <a
                  href="/admin/coupons"
                  className="font-medium text-primary hover:underline"
                >
                  Coupons
                </a>{' '}
                section, then group them into campaigns here.
              </p>
            </div>
          ) : (
            data.groups.map((group) => (
              <div
                key={group.name}
                className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                {/* Group header */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg',
                        group.name === 'Uncategorized'
                          ? 'bg-gray-200 dark:bg-gray-700'
                          : 'bg-primary/10'
                      )}
                    >
                      <Megaphone
                        className={cn(
                          'h-4.5 w-4.5',
                          group.name === 'Uncategorized'
                            ? 'text-gray-500'
                            : 'text-primary'
                        )}
                      />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        {group.name}
                      </h2>
                      <p className="text-xs text-gray-500">
                        {group.couponCount} coupon
                        {group.couponCount === 1 ? '' : 's'} ·{' '}
                        {group.activeCount} active ·{' '}
                        {group.usedCount} redemptions
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    ৳{group.discountAmount.toLocaleString()} discount given
                  </span>
                </div>

                {/* Coupon rows */}
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {group.coupons.map((c) => {
                    const editingThis =
                      editing[c._id] !== undefined
                        ? editing[c._id]
                        : group.name === 'Uncategorized'
                        ? ''
                        : group.name;
                    const isEditing = editing[c._id] !== undefined;
                    return (
                      <div
                        key={c._id}
                        className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                              {c.code}
                            </span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                                c.isActive
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                              )}
                            >
                              {c.isActive ? 'ACTIVE' : 'PAUSED'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500 truncate">
                            {c.name} · {typeLabel(c.type)} {c.value}
                            {c.type === 'percentage' ? '%' : ' ৳'} ·{' '}
                            {c.usedCount} uses · ৳{c.usage.toLocaleString()}{' '}
                            discount
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <input
                                value={editingThis}
                                onChange={(e) =>
                                  setEditing((prev) => ({
                                    ...prev,
                                    [c._id]: e.target.value,
                                  }))
                                }
                                placeholder="Campaign name…"
                                className="w-44 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                              <button
                                onClick={() => assignCampaign(c._id, editingThis)}
                                disabled={!!busyId}
                                className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                              >
                                {busyId === c._id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  setEditing((e) => {
                                    const next = { ...e };
                                    delete next[c._id];
                                    return next;
                                  })
                                }
                                className="rounded-lg border border-gray-300 dark:border-gray-700 p-1.5 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                                aria-label="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-gray-400">
                                {group.name === 'Uncategorized'
                                  ? 'No campaign'
                                  : group.name}
                              </span>
                              <button
                                onClick={() =>
                                  setEditing((e) => ({
                                    ...e,
                                    [c._id]: group.name === 'Uncategorized' ? '' : group.name,
                                  }))
                                }
                                className="rounded-lg border border-gray-300 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                Change
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}