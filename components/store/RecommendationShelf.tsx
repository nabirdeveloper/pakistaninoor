'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import ProductCard from '@/components/store/ProductCard';
import { getRecentViewIds } from '@/lib/store/recentViews';
import { cn } from '@/lib/utils';

interface ShelfProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  images: Array<{ url: string; isPrimary: boolean }>;
  averageRating: number;
  totalReviews: number;
  badges: string[];
  isNewArrival: boolean;
  isBestSeller: boolean;
  isOnSale: boolean;
}

interface RecommendationShelfProps {
  /** Which engine feeds this shelf (see /api/recommendations). */
  mode: 'for-you' | 'frequently-bought' | 'related' | 'cross-sell' | 'upsell' | 'recently-viewed' | 'trending';
  /** Product id used by frequently-bought / related. */
  productId?: string;
  limit?: number;
  /** Overrides the default section heading. */
  title?: string;
  subtitle?: string;
  /** Highlights the shelf with the AI sparkle badge. */
  aiBadge?: boolean;
  /** Pass guest signals from localStorage when true (used by for-you). */
  useLocalRecent?: boolean;
  /**
   * Bumping this value re-runs the fetch. Cart pages pass a signature of the
   * current cart items so the shelf refreshes whenever the cart changes.
   */
  refreshKey?: string;
  className?: string;
}

export default function RecommendationShelf({
  mode,
  productId,
  limit = 8,
  title,
  subtitle,
  aiBadge = true,
  useLocalRecent = false,
  refreshKey,
  className,
}: RecommendationShelfProps) {
  const [products, setProducts] = useState<ShelfProduct[]>([]);
  const [heading, setHeading] = useState('');
  const [loading, setLoading] = useState(true);

  const viewedParam = useMemo(
    () => (useLocalRecent ? getRecentViewIds() : []),
    // Re-read guest signals whenever the hook mounts (fresh page view)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    let cancelled = false;

    const fetchRecommendations = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ mode, limit: String(limit) });
        if (productId) params.set('productId', productId);
        if (viewedParam.length > 0) params.set('viewed', viewedParam.join(','));

        const res = await fetch(`/api/recommendations?${params.toString()}`);
        if (!res.ok) throw new Error(`recommendations ${res.status}`);
        const data = await res.json();

        if (cancelled) return;
        setProducts(data.products || []);
        setHeading(data.title || '');
      } catch (err) {
        console.error('RecommendationShelf failed:', err);
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRecommendations();
    return () => {
      cancelled = true;
    };
  }, [mode, productId, limit, viewedParam, refreshKey]);

  if (!loading && products.length === 0) return null;

  return (
    <section className={cn('py-10 md:py-14', className)}>
      <div className="container mx-auto px-4">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
              {title || heading || 'You May Also Like'}
            </h2>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
          {aiBadge && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Sparkles size={12} />
              AI powered
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700 aspect-[3/4]"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}