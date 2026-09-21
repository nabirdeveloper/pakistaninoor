'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, CornerDownLeft, Sparkles, TrendingUp } from 'lucide-react';
import ProductCard from '@/components/store/ProductCard';

interface Product {
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

interface Suggestion {
  type: 'product' | 'category' | 'query';
  text: string;
  score: number;
  id?: string;
  slug?: string;
}

interface SuggestionResponse {
  suggestions: Suggestion[];
  didYouMean: string | null;
  correctedQuery: string | null;
  source: 'ai' | 'local';
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const [input, setInput] = useState(q);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [suggestionData, setSuggestionData] = useState<SuggestionResponse | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const didYouMean = suggestionData?.didYouMean || null;
  const showDidYouMean =
    didYouMean && didYouMean.toLowerCase() !== q.toLowerCase() ? didYouMean : null;
  const lastQueryRef = useRef('');

  // Fetch products for the query
  const fetchProducts = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('search', query);
      params.set('page', '1');
      params.set('limit', '24');
      params.set('sortBy', 'salesCount');
      const response = await fetch(`/api/products?${params.toString()}`);
      const data = await response.json();
      setProducts(data.products || []);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch search results:', error);
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch AI suggestions (did-you-mean + related queries)
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSuggestionData(null);
      return;
    }
    setSuggestionsLoading(true);
    try {
      const response = await fetch(
        `/api/search/suggestions?q=${encodeURIComponent(query)}&limit=8`
      );
      const data = await response.json();
      setSuggestionData(data);
    } catch {
      setSuggestionData(null);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    setInput(q);
    if (q) {
      fetchProducts(q);
      fetchSuggestions(q);
      lastQueryRef.current = q;
    } else {
      setProducts([]);
      setTotal(0);
      setSuggestionData(null);
    }
  }, [q, fetchProducts, fetchSuggestions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
      lastQueryRef.current = query;
      fetchSuggestions(query);
    }
  };

  const pickSuggestion = (s: Suggestion) => {
    if (s.type === 'product' && s.slug) {
      router.push(`/product/${s.slug}`);
    } else if (s.type === 'category' && s.slug) {
      router.push(`/category/${s.slug}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(s.text)}`);
    }
  };

  const relatedQueries = (suggestionData?.suggestions || [])
    .filter((s) => s.type === 'query')
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Search Results
          </h1>

          {/* Search box */}
          <form onSubmit={handleSubmit} className="mt-4 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search products..."
                autoFocus
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 py-3 pl-12 pr-12 text-gray-900 dark:text-white placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                aria-label="Search"
              >
                <CornerDownLeft className="h-4 w-4" />
              </button>
            </div>
          </form>

          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {loading ? (
              'Searching...'
            ) : q ? (
              <>
                {total} {total === 1 ? 'result' : 'results'} for{' '}
                <span className="font-medium text-gray-700 dark:text-gray-200">“{q}”</span>
              </>
            ) : (
              'Type a query to search the catalog'
            )}
          </div>

          {/* Did you mean banner */}
          {showDidYouMean && !loading && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-200">
                Did you mean{' '}
                <button
                  onClick={() => {
                    router.push(`/search?q=${encodeURIComponent(showDidYouMean)}`);
                  }}
                  className="font-semibold text-primary hover:underline underline-offset-2"
                >
                  “{showDidYouMean}”
                </button>
                ?
              </span>
              {suggestionData?.source === 'ai' && (
                <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-primary/70">
                  <Sparkles className="h-3 w-3" /> AI
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Related searches */}
        {relatedQueries.length > 0 && !loading && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              People also search
            </div>
            <div className="flex flex-wrap gap-2">
              {relatedQueries.map((s, i) => (
                <button
                  key={i}
                  onClick={() => pickSuggestion(s)}
                  className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
                >
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200 dark:bg-gray-700" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-400 mb-4">
              <Search className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No products found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              We couldn{"'"}t find anything matching{' '}
              <span className="font-medium">“{q}”</span>
            </p>
            {suggestionsLoading ? (
              <p className="text-sm text-gray-400 mb-6">Checking for similar searches...</p>
            ) : showDidYouMean ? (
              <button
                onClick={() => router.push(`/search?q=${encodeURIComponent(showDidYouMean)}`)}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Search for “{showDidYouMean}” instead
              </button>
            ) : (
              <Link
                href="/products"
                className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Browse all products
              </Link>
            )}
            {!suggestionsLoading &&
              (suggestionData?.suggestions || []).filter((s) => s.type === 'product').length > 0 && (
                <div className="mt-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    You might also like:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {(suggestionData?.suggestions || [])
                      .filter((s) => s.type === 'product')
                      .slice(0, 4)
                      .map((s, i) => (
                        <button
                          key={i}
                          onClick={() => pickSuggestion(s)}
                          className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
                        >
                          {s.text}
                        </button>
                      ))}
                  </div>
                </div>
              )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
          >
            {products.map((product, index) => (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700 aspect-[3/4]"
                />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}