'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Star,
  Users,
  Coins,
  Award,
  Settings2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  loyaltyPoints: number;
  referralCode?: string;
}

interface LoyaltyData {
  stats: {
    members: number;
    totalPoints: number;
    avgPoints: number;
  };
  topUsers: TopUser[];
  settings: {
    enabled: boolean;
    pointsPerPurchase: number;
    pointsRedemptionRate: number;
    minPointsForRedemption: number;
    referralBonus: number;
  } | null;
}

export default function LoyaltyPage() {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/loyalty', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load loyalty data');
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Failed to load loyalty data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statCards = [
    {
      name: 'Active Members',
      value: data?.stats.members ?? 0,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      name: 'Points Outstanding',
      value: (data?.stats.totalPoints ?? 0).toLocaleString(),
      icon: Coins,
      color: 'text-amber-600',
      bg: 'bg-amber-100 dark:bg-amber-900/20',
    },
    {
      name: 'Avg Points / Member',
      value: (data?.stats.avgPoints ?? 0).toLocaleString(),
      icon: Award,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100 dark:bg-emerald-900/20',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Loyalty Program
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Points balance, top members and program configuration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <Link
            href="/admin/settings?tab=loyalty"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Settings2 className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-20 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Program config */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                Program Configuration
              </h2>
              {data?.settings && (
                <span
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium',
                    data.settings.enabled
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  )}
                >
                  {data.settings.enabled ? 'Enabled' : 'Disabled'}
                </span>
              )}
            </div>
            {data?.settings ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Points per ৳100 purchase
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                    {data.settings.pointsPerPurchase}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    1 point = ৳
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                    {data.settings.pointsRedemptionRate}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Min points to redeem
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                    {data.settings.minPointsForRedemption}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Referral bonus (points)
                  </p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                    {data.settings.referralBonus}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No loyalty configuration saved yet.{' '}
                <Link
                  href="/admin/settings?tab=loyalty"
                  className="font-medium text-primary hover:underline"
                >
                  Configure it now
                </Link>
              </p>
            )}
          </div>

          {/* Top members */}
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Top Members by Points
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Referral Code
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {!data?.topUsers || data.topUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-sm text-gray-500"
                      >
                        No members with points yet.
                      </td>
                    </tr>
                  ) : (
                    data.topUsers.map((u, i) => (
                      <tr
                        key={u._id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="px-6 py-3 text-sm text-gray-400">
                          {i + 1}
                        </td>
                        <td className="px-6 py-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {u.name || '—'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {u.email || u.phone || ''}
                          </p>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {u.referralCode || '—'}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
                            <Star className="h-3.5 w-3.5" />
                            {u.loyaltyPoints.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}