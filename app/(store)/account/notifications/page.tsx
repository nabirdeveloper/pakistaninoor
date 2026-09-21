'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, BellRing, CheckCheck, Package, PackagePlus, TrendingDown, Gift, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Notice {
  _id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  image?: string;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, typeof Package> = {
  order_placed: Package,
  order_confirmed: Package,
  order_shipped: Package,
  order_delivered: Package,
  order_cancelled: Package,
  refund_processed: Package,
  back_in_stock: PackagePlus,
  price_drop: TrendingDown,
  abandoned_cart: Gift,
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
];

export default function AccountNotificationsPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchNotifications = useCallback(async (onlyUnread: boolean) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '50', ...(onlyUnread ? { unread: 'true' } : {}) });
      const response = await fetch(`/api/notifications?${params}`);
      const data = await response.json();
      if (Array.isArray(data.notifications)) setNotices(data.notifications);
      setUnread(data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(filter === 'unread');
  }, [filter, fetchNotifications]);

  const markAllRead = async () => {
    await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    setUnread(0);
    setNotices((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading notifications…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Order updates, back-in-stock alerts and price drops.
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read ({unread})
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              filter === tab.value
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
            )}
          >
            {tab.label}
            {tab.value === 'unread' && unread > 0 && ` (${unread})`}
          </button>
        ))}
      </div>

      {notices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <Bell className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-gray-500 dark:text-gray-400">
            {filter === 'unread' ? 'All caught up — no unread notifications.' : 'No notifications yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => {
            const Icon = TYPE_ICONS[notice.type] || AlertCircle;
            return (
              <div
                key={notice._id}
                className={cn(
                  'flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800',
                  !notice.isRead && 'border-primary/40'
                )}
              >
                <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">{notice.title}</h3>
                    {!notice.isRead && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        <BellRing className="h-3 w-3" /> New
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{notice.message}</p>
                  <p className="mt-1.5 text-xs text-gray-400">
                    {new Date(notice.createdAt).toLocaleString()}
                  </p>
                </div>
                {notice.link && (
                  <Link
                    href={notice.link}
                    className="inline-flex items-center gap-1 self-center rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-primary hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700"
                  >
                    View <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}