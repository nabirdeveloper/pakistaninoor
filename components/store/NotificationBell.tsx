'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellRing,
  CheckCheck,
  Package,
  PackagePlus,
  TrendingDown,
  Gift,
  AlertCircle,
} from 'lucide-react';
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

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/notifications?limit=8');
        const data = await response.json();
        if (cancelled) return;
        setNotices(data.notifications || []);
        setUnread(data.unreadCount || 0);
      } catch (error) {
        console.error('Failed to load notifications:', error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAllRead = async () => {
    await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    setUnread(0);
    setNotices((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const openNotification = async (notice: Notice) => {
    if (!notice.isRead) {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notice._id }),
      });
      setUnread((prev) => Math.max(0, prev - 1));
      setNotices((prev) => prev.map((n) => (n._id === notice._id ? { ...n, isRead: true } : n)));
    }
    if (notice.link) router.push(notice.link);
    setOpen(false);
  };

  if (status !== 'authenticated' || !session?.user) {
    return null;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        aria-label="Notifications"
      >
        {unread > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute right-0 z-20 mt-2 w-80 sm:w-96 rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                <p className="font-medium text-gray-900 dark:text-white">Notifications</p>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {!loaded ? (
                  <div className="flex items-center justify-center gap-2 p-6 text-sm text-gray-400">
                    <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    Loading…
                  </div>
                ) : notices.length === 0 ? (
                  <div className="p-6 text-center">
                    <Bell className="mx-auto h-6 w-6 text-gray-300 dark:text-gray-600" />
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      No notifications yet. We&apos;ll let you know about orders, restocks and price
                      drops here.
                    </p>
                  </div>
                ) : (
                  notices.map((notice) => {
                    const Icon = TYPE_ICONS[notice.type] || AlertCircle;
                    return (
                      <button
                        key={notice._id}
                        onClick={() => openNotification(notice)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700',
                          !notice.isRead && 'bg-primary/5'
                        )}
                      >
                        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-gray-900 dark:text-white">
                            {notice.title}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {notice.message}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
                            {timeAgo(notice.createdAt)}
                            {!notice.isRead && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="border-t border-gray-100 p-2 dark:border-gray-700">
                <Link
                  href="/account/notifications"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-center text-sm font-medium text-primary hover:bg-primary/5"
                >
                  View all notifications
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}