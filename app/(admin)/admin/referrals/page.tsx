'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  BadgePercent,
  Search,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Referral {
  _id: string;
  referralCode: string;
  status: 'pending' | 'completed' | 'expired';
  referrerBonus: number;
  referredBonus: number;
  referrerBonusPaid: boolean;
  referredBonusPaid: boolean;
  firstOrderAmount?: number;
  completedAt?: string;
  createdAt: string;
  referrerName?: string;
  referrerEmail?: string;
  referrerPhone?: string;
  referredName?: string;
  referredEmail?: string;
  referredPhone?: string;
}

interface Stats {
  total: number;
  completed: number;
  pending: number;
  expired: number;
  bonusPaid: number;
}

const statusTabs = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'pending', label: 'Pending' },
  { id: 'expired', label: 'Expired' },
] as const;

type StatusFilter = (typeof statusTabs)[number]['id'];

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeReferrers, setActiveReferrers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: filter });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/admin/referrals?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load referrals');
      setReferrals(data.referrals || []);
      setStats(data.stats);
      setActiveReferrers(data.activeReferrers || 0);
    } catch (error: any) {
      console.error(error);
      setMessage(`⚠️ ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const togglePaid = async (r: Referral, bonus: 'referrer' | 'referred') => {
    const paid = bonus === 'referrer' ? !r.referrerBonusPaid : !r.referredBonusPaid;
    setBusyId(`${r._id}:${bonus}`);
    try {
      const res = await fetch(`/api/admin/referrals/${r._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bonus, paid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update referral');
      const updated = data.referral;
      setReferrals((list) =>
        list.map((x) =>
          x._id === r._id
            ? {
                ...x,
                referrerBonusPaid: updated.referrerBonusPaid,
                referredBonusPaid: updated.referredBonusPaid,
              }
            : x
        )
      );
    } catch (error: any) {
      setMessage(`⚠️ ${error.message}`);
    } finally {
      setBusyId('');
    }
  };

  const formatDate = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—';

  const statCards = [
    {
      name: 'Total Referrals',
      value: stats?.total ?? 0,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      name: 'Completed',
      value: stats?.completed ?? 0,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      name: 'Pending',
      value: stats?.pending ?? 0,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-100 dark:bg-amber-900/20',
    },
    {
      name: 'Expired',
      value: stats?.expired ?? 0,
      icon: XCircle,
      color: 'text-gray-600',
      bg: 'bg-gray-100 dark:bg-gray-800',
    },
    {
      name: 'Bonuses Paid',
      value: `৳${(stats?.bonusPaid ?? 0).toLocaleString()}`,
      icon: Wallet,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100 dark:bg-emerald-900/20',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Referrals
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track customer referrals, bonuses and payouts (
            {activeReferrers} active referrers).
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div
            key={card.name}
            className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  card.bg
                )}
              >
                <card.icon className={cn('h-5 w-5', card.color)} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {card.name}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {card.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {message && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {message}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                filter === tab.id
                  ? 'bg-primary text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 md:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name or email…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Referrer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Referred
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Referrer Bonus
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Referred Bonus
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  First Order
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    Loading referrals…
                  </td>
                </tr>
              )}
              {!loading && referrals.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    No referrals match this view.
                  </td>
                </tr>
              )}
              {!loading &&
                referrals.map((r) => (
                  <tr
                    key={r._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {r.referrerName || '—'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {r.referrerEmail || r.referrerPhone || ''}
                        <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-primary">
                          <BadgePercent className="h-3 w-3" />
                          {r.referralCode}
                        </span>
                      </p>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {r.referredName || '—'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {r.referredEmail || r.referredPhone || ''}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                          r.status === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : r.status === 'pending'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-sm text-gray-700 dark:text-gray-200">
                          ৳{r.referrerBonus}
                        </span>
                        <button
                          onClick={() => togglePaid(r, 'referrer')}
                          disabled={!!busyId}
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium border',
                            r.referrerBonusPaid
                              ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400'
                              : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                          )}
                          title={
                            r.referrerBonusPaid
                              ? 'Mark as unpaid'
                              : 'Mark as paid'
                          }
                        >
                          {busyId === `${r._id}:referrer`
                            ? '…'
                            : r.referrerBonusPaid
                            ? 'Paid ✓'
                            : 'Unpaid'}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-sm text-gray-700 dark:text-gray-200">
                          ৳{r.referredBonus}
                        </span>
                        <button
                          onClick={() => togglePaid(r, 'referred')}
                          disabled={!!busyId}
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-medium border',
                            r.referredBonusPaid
                              ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400'
                              : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                          )}
                          title={
                            r.referredBonusPaid
                              ? 'Mark as unpaid'
                              : 'Mark as paid'
                          }
                        >
                          {busyId === `${r._id}:referred`
                            ? '…'
                            : r.referredBonusPaid
                            ? 'Paid ✓'
                            : 'Unpaid'}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {r.firstOrderAmount ? (
                        <>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            ৳{r.firstOrderAmount.toLocaleString()}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {formatDate(r.completedAt)}
                          </p>
                        </>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}