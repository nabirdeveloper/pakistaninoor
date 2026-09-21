'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Package, SlidersHorizontal } from 'lucide-react';
import ProductCard from '@/components/store/ProductCard';

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
}

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
  stock?: number;
  hasVariants?: boolean;
  variants?: Array<{ stock: number }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const sortOptions = [
  { value: 'createdAt-desc', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'salesCount-desc', label: 'Best Selling' },
  { value: 'averageRating-desc', label: 'Top Rated' },
];

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sort, setSort] = useState('createdAt-desc');
  const [page, setPage] = useState(1);

  const loadCategory = useCallback(async () => {
    try {
      const res = await fetch('/api/categories?flat=true&parent=all');
      const data = await res.json();
      const found = (data.categories || []).find(
        (c: Category) => c.slug === slug
      );
      if (found) {
        setCategory(found);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error('Failed to load category:', error);
      setNotFound(true);
    }
  }, [slug]);

  const loadProducts = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    try {
      const [sortBy, sortOrder] = sort.split('-');
      const params = new URLSearchParams({
        category: category._id,
        page: String(page),
        limit: '12',
        sortBy,
        sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
      });
      const res = await fetch(`/api/products?${params.toString()}`);
      const data = await res.json();
      setProducts(data.products || []);
      setPagination(data.pagination || null);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  }, [category, sort, page]);

  useEffect(() => {
    loadCategory();
  }, [loadCategory]);

  useEffect(() => {
    if (category) loadProducts();
  }, [loadProducts, category]);

  // Reset page when category or sort changes
  useEffect(() => {
    setPage(1);
  }, [slug, sort]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Category not found
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          The category you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Browse all products
        </Link>
      </div>
    );
  }

  if (!category && loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/products" className="hover:text-primary">
          Products
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 dark:text-white font-medium">
          {category?.name}
        </span>
      </nav>

      {/* Category banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/90 to-primary-dark/90 text-white mb-8">
        <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-14 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold">{category?.name}</h1>
          {category?.description && (
            <p className="mt-3 text-sm sm:text-base text-white/85">
              {category.description}
            </p>
          )}
          <p className="mt-4 text-sm text-white/70">
            {pagination
              ? `${pagination.total} product${pagination.total === 1 ? '' : 's'}`
              : 'Loading products…'}
          </p>
        </div>
        {category?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={category.image}
            alt={category.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <SlidersHorizontal className="h-4 w-4" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="py-16 text-center text-gray-500">Loading products…</div>
      ) : products.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-gray-500 dark:text-gray-400">
            No products in this category yet.
          </p>
          <Link
            href="/products"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Browse all products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-2">
          <button
            disabled={!pagination.hasPrevPage}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-3 text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={!pagination.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}