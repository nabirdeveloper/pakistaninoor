'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  UserRound,
  Clock,
  Send,
  Sparkles,
  Wallet,
  RefreshCw,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AbandonedCartRecord {
  cartId: string;
  user: { _id: string; name: string; email: string } | null;
  items: Array<{ name: string; image?: string; slug: string; price: number; quantity: number }>;
  subtotal: number;
  total: number;
  itemCount: number;
  lastActivity: string;
  hoursSince: number;
  recoverySentAt?: string;
}

interface Counts {
  total: number;
  pending: number;
  sent: number;
}

const HOUR_OPTIONS = [
  { value: 12, label: '12h' },
  { value: 24, label: '24h' },
  { value: 48, label: '48h' },
  { value: 72, label: '72h' },
  { value: 168, label: '7d' },
];

export default function AdminAbandonedCartsPage() {
  const [carts, setCarts] = useState<AbandonedCartRecord[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recoverableValue, setRecoverableValue] = useState(0);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; message: string }>>({});

  const fetchCarts = useCallback(async (h: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ hours: String(h), limit: '200' });
      const response = await fetch(`/api/admin/abandoned-carts?${params}`);
      const data = await response.json();
      if (Array.isArray(data.carts)) setCarts(data.carts);
      if (data.counts) setCounts(data.counts);
      if (typeof data.recoverableValue === 'number') setRecoverableValue(data.recoverableValue);
    } catch (error) {
      console.error('Failed to fetch abandoned carts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCarts(hours);
  }, [hours, fetchCarts]);

  const draftMessage = async (cart: AbandonedCartRecord) => {
    setBusyId(cart.cartId);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/abandoned-carts/${cart.cartId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(`Draft failed: ${data.error || 'unknown error'}`);
        return;
      }
      setDrafts((prev) => ({
        ...prev,
        [cart.cartId]: { subject: data.result.subject, message: data.result.message },
      }));
    } catch (error) {
      console.error('Failed to draft recovery message:', error);
      setNotice('Network error while drafting.');
    } finally {
      setBusyId(null);
    }
  };

  const sendRecovery = async (cart: AbandonedCartRecord) => {
    const draft = drafts[cart.cartId];
    if (!draft || !draft.subject.trim() || !draft.message.trim()) {
      setNotice('Draft a message first (or press "Draft with AI").');
      return;
    }
    setBusyId(cart.cartId);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/abandoned-carts/${cart.cartId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: draft.subject, message: draft.message }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(`Send failed: ${data.error || 'unknown error'}`);
        return;
      }
      setNotice('Recovery message sent ✅');
      await fetchCarts(hours);
    } catch (error) {
      console.error('Failed to send recovery message:', error);
      setNotice('Network error while sending.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Abandoned Cart Recovery</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Carts that haven&apos;t been touched recently, sorted by value. Draft a personalized
            recovery message with AI and send it as an in-app notification.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
            {HOUR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHours(opt.value)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  hours === opt.value
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchCarts(hours)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">At-risk carts</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{counts?.total ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <Mail className="h-5 w-5 text-amber-500" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Not yet recovered</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{counts?.pending ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <Wallet className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Recoverable value</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              ৳{recoverableValue.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>

      {notice && (
        <p className="rounded-lg bg-blue-50 px-4 py-2.5 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {notice}
        </p>
      )}

      {/* Cart list */}
      <div className="space-y-4">
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
        ) : carts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
            <ShoppingCart className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-gray-500 dark:text-gray-400">
              No abandoned carts in the last {hours}h. Carts that are left untouched for a while
              will appear here.
            </p>
          </div>
        ) : (
          carts.map((cart) => {
            const alreadySent = !!cart.recoverySentAt;
            const draft = drafts[cart.cartId];
            return (
              <motion.div
                key={cart.cartId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <UserRound className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {cart.user?.name || 'Unknown customer'}
                      </span>
                      {cart.user?.email && (
                        <span className="text-xs text-gray-400">{cart.user.email}</span>
                      )}
                      {alreadySent ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                          <CheckCircle2 className="h-3 w-3" /> Recovery sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          <Clock className="h-3 w-3" /> {cart.hoursSince}h since activity
                        </span>
                      )}
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        ৳{cart.total.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {cart.items.map((item, index) => (
                        <span
                          key={index}
                          className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-300"
                        >
                          {item.name} ×{item.quantity}
                        </span>
                      ))}
                    </div>

                    <p className="mt-2 text-xs text-gray-400">
                      Last active {new Date(cart.lastActivity).toLocaleString()}
                      {cart.recoverySentAt &&
                        ` · recovered ${new Date(cart.recoverySentAt).toLocaleString()}`}
                    </p>
                  </div>

                  {!alreadySent && (
                    <div className="flex w-full flex-col gap-2 sm:w-96">
                      {draft && (
                        <>
                          <input
                            value={draft.subject}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [cart.cartId]: { ...prev[cart.cartId], subject: e.target.value },
                              }))
                            }
                            maxLength={200}
                            placeholder="Subject"
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                          <textarea
                            value={draft.message}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [cart.cartId]: { ...prev[cart.cartId], message: e.target.value },
                              }))
                            }
                            maxLength={3000}
                            rows={4}
                            placeholder="Recovery message…"
                            className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                        </>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => draftMessage(cart)}
                          disabled={busyId === cart.cartId}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-40"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {busyId === cart.cartId ? 'Working…' : 'Draft with AI'}
                        </button>
                        {draft && (
                          <button
                            onClick={() => sendRecovery(cart)}
                            disabled={busyId === cart.cartId}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
                          >
                            <Send className="h-3.5 w-3.5" /> Send recovery
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}