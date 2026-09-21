'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { BellRing, BellPlus, TrendingDown, PackagePlus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlertBellProps {
  productId: string;
  slug: string;
  /** Current displayed price (variant-aware) — used only for copy. */
  price?: number;
  /** Whether the currently selected variant/product is out of stock. */
  outOfStock?: boolean;
  className?: string;
}

type AlertType = 'back_in_stock' | 'price_drop';

/**
 * Product alert subscription bell (Phase 4).
 *
 * Lets signed-in shoppers subscribe to "back in stock" (shown when the product
 * is out of stock) and "price drop" notifications for this product. Subscriptions
 * live in ProductAlert and fire as in-app notifications via
 * lib/notifications/checkProductAlerts.ts.
 */
export default function ProductAlertBell({
  productId,
  slug,
  price,
  outOfStock = false,
  className,
}: AlertBellProps) {
  const { data: session, status } = useSession();
  const authenticated = status === 'authenticated' && !!session?.user;

  const [subscribed, setSubscribed] = useState<Record<AlertType, boolean>>({
    back_in_stock: false,
    price_drop: false,
  });
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<Record<AlertType, boolean>>({
    back_in_stock: false,
    price_drop: false,
  });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load current subscription state once the user is known.
  useEffect(() => {
    if (status === 'loading') return;
    if (!authenticated) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/alerts?productId=${encodeURIComponent(productId)}`);
        const data = await response.json();
        if (cancelled) return;
        if (response.ok) {
          setSubscribed({
            back_in_stock: Boolean(data.backInStock),
            price_drop: Boolean(data.priceDrop),
          });
        }
      } catch (error) {
        console.error('Failed to load alert subscriptions:', error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, authenticated, productId]);

  const toggle = async (type: AlertType) => {
    const currentlySubscribed = subscribed[type];
    setPending((prev) => ({ ...prev, [type]: true }));
    setNotice(null);
    try {
      const response = await fetch('/api/alerts', {
        method: currentlySubscribed ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, type }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice({ type: 'error', text: data.error || 'Could not update the alert.' });
        return;
      }
      setSubscribed((prev) => ({ ...prev, [type]: !currentlySubscribed }));
      setNotice({
        type: 'success',
        text: currentlySubscribed
          ? 'Alert turned off.'
          : type === 'back_in_stock'
            ? "We'll notify you when this product is back in stock."
            : "We'll notify you when the price drops.",
      });
    } catch (error) {
      console.error('Failed to toggle product alert:', error);
      setNotice({ type: 'error', text: 'Network error — please try again.' });
    } finally {
      setPending((prev) => ({ ...prev, [type]: false }));
    }
  };

  // The back-in-stock bell is only meaningful when the product is unavailable.
  const showBackInStock = outOfStock;

  if (status === 'loading') {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <BellRing className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {authenticated ? 'Get notified about this product' : 'Want to know when this changes?'}
        </p>
      </div>

      {!authenticated ? (
        <Link
          href={`/auth/login?redirect=/product/${slug}`}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
        >
          <BellPlus className="h-4 w-4" />
          Sign in for restock &amp; price-drop alerts
        </Link>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {showBackInStock && (
              <button
                onClick={() => toggle('back_in_stock')}
                disabled={pending.back_in_stock}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                  subscribed.back_in_stock
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-300 text-gray-600 hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-300'
                )}
              >
                {subscribed.back_in_stock ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <PackagePlus className="h-3.5 w-3.5" />
                )}
                {pending.back_in_stock
                  ? 'Saving…'
                  : subscribed.back_in_stock
                    ? 'Notify when back in stock ✓'
                    : 'Notify when back in stock'}
              </button>
            )}

            <button
              onClick={() => toggle('price_drop')}
              disabled={pending.price_drop}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                subscribed.price_drop
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-300 text-gray-600 hover:border-primary hover:text-primary dark:border-gray-600 dark:text-gray-300'
              )}
            >
              {subscribed.price_drop ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {pending.price_drop
                ? 'Saving…'
                : subscribed.price_drop
                  ? 'Notify on price drop ✓'
                  : 'Notify on price drop'}
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            {price !== undefined && price > 0
              ? `Current price ৳${price.toLocaleString()} — alerts arrive as in-app notifications.`
              : 'Alerts arrive as in-app notifications.'}
          </p>

          {notice && (
            <p
              className={cn(
                'mt-2 flex items-center gap-1.5 text-xs',
                notice.type === 'success'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {notice.type === 'success' ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <BellRing className="h-3.5 w-3.5" />
              )}
              {notice.text}
            </p>
          )}
        </>
      )}
      {!loaded && authenticated && <p className="mt-2 text-xs text-gray-400">Loading…</p>}
    </div>
  );
}