'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Plus,
  RefreshCw,
  Minus,
  Save,
  ExternalLink,
  Pencil,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Product {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  barcode?: string;
  price: number;
  costPrice?: number;
  stock: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  status: string;
  salesCount?: number;
  images?: Array<{ url: string; alt?: string }>;
  category?: { name?: string; slug?: string } | string | null;
}

interface Stats {
  total: number;
  tracked: number;
  inStock: number;
  outOfStock: number;
  lowStock: number;
  stockValue: number;
}

const viewTabs = [
  { id: 'all', label: 'All Products' },
  { id: 'low', label: 'Low Stock' },
  { id: 'out', label: 'Out of Stock' },
  { id: 'stocked', label: 'In Stock' },
] as const;

type View = (typeof viewTabs)[number]['id'];

export default function InventoryPage() {
  const [view, setView] = useState<View>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view,
        page: String(page),
        limit: '25',
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/admin/inventory?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load inventory');
      setStats(data.stats);
      setProducts(data.products);
      setTotal(data.total);
      setPages(data.pages || 1);
    } catch (error: any) {
      console.error(error);
      setMessage(`⚠️ ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [view, page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [view, debouncedSearch]);

  const applyStock = async (p: Product) => {
    const nextVal = editing[p._id];
    const qty = parseInt(nextVal, 10);
    if (isNaN(qty) || qty < 0) return;
    setSaving((s) => ({ ...s, [p._id]: true }));
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: p.slug, quantity: qty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update stock');
      setProducts((list) =>
        list.map((it) =>
          it._id === p._id ? { ...it, stock: data.product.stock } : it
        )
      );
      setEditing((e) => {
        const next = { ...e };
        delete next[p._id];
        return next;
      });
    } catch (error: any) {
      console.error(error);
      setMessage(`⚠️ ${error.message}`);
    } finally {
      setSaving((s) => {
        const next = { ...s };
        delete next[p._id];
        return next;
      });
    }
  };

  const quickRestock = async (p: Product) => {
    // Restock to 2x the low-stock threshold (minimum 10 units).
    const target = Math.max(p.lowStockThreshold * 2, 10);
    setSaving((s) => ({ ...s, [p._id]: true }));
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: p.slug, delta: target - p.stock }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update stock');
      setProducts((list) =>
        list.map((it) =>
          it._id === p._id ? { ...it, stock: data.product.stock } : it
        )
      );
    } catch (error: any) {
      console.error(error);
      setMessage(`⚠️ ${error.message}`);
    } finally {
      setSaving((s) => {
        const next = { ...s };
        delete next[p._id];
        return next;
      });
    }
  };

  const statCards = [
    {
      name: 'Total Products',
      value: stats?.total ?? 0,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      name: 'In Stock',
      value: stats?.inStock ?? 0,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      name: 'Low Stock',
      value: stats?.lowStock ?? 0,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-100 dark:bg-amber-900/20',
    },
    {
      name: 'Out of Stock',
      value: stats?.outOfStock ?? 0,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-100 dark:bg-red-900/20',
    },
    {
      name: 'Inventory Value (cost)',
      value: `৳${(stats?.stockValue ?? 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-indigo-600',
      bg: 'bg-indigo-100 dark:bg-indigo-900/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Inventory
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track stock levels, low-stock alerts and restock in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <motion.div
            key={card.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
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
          </motion.div>
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
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                view === tab.id
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
            placeholder="Search by name, SKU…"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {total} product{total === 1 ? '' : 's'}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  SKU
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Price
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Stock
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Threshold
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    Loading inventory…
                  </td>
                </tr>
              )}
              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    No products match this view.
                  </td>
                </tr>
              )}
              {!loading &&
                products.map((p) => {
                  const isLow =
                    p.stock > 0 && p.stock <= p.lowStockThreshold;
                  const isOut = p.stock <= 0;
                  const editingThis = editing[p._id];
                  const isSaving = saving[p._id];
                  return (
                    <tr
                      key={p._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
                            {p.images?.[0]?.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.images[0].url}
                                alt={p.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Package className="h-4 w-4 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div>
                            <Link
                              href={`/admin/products/${p.slug}`}
                              className="text-sm font-medium text-gray-900 dark:text-white hover:text-primary"
                            >
                              {p.name}
                            </Link>
                            <p className="text-xs text-gray-500">
                              {p.salesCount ? `${p.salesCount} sold` : 'No sales yet'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {p.sku}
                      </td>
                      <td className="px-6 py-3 text-right text-sm text-gray-600 dark:text-gray-300">
                        ৳{p.price.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {editingThis !== undefined ? (
                            <>
                              <button
                                onClick={() =>
                                  setEditing((e) => ({
                                    ...e,
                                    [p._id]: String(
                                      Math.max(0, (parseInt(editingThis) || 0) - 1)
                                    ),
                                  }))
                                }
                                className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                                aria-label="Decrease"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                value={editingThis}
                                onChange={(e) =>
                                  setEditing((prev) => ({
                                    ...prev,
                                    [p._id]: e.target.value,
                                  }))
                                }
                                className="w-16 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-0.5 text-center text-sm text-gray-900 dark:text-white"
                              />
                              <button
                                onClick={() =>
                                  setEditing((e) => ({
                                    ...e,
                                    [p._id]: String(
                                      (parseInt(editingThis) || 0) + 1
                                    ),
                                  }))
                                }
                                className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                                aria-label="Increase"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => applyStock(p)}
                                disabled={isSaving}
                                className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
                                aria-label="Save stock"
                              >
                                {isSaving ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  setEditing((e) => ({
                                    ...e,
                                    [p._id]: String(p.stock),
                                  }))
                                }
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                  isOut
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                    : isLow
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                    : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                )}
                                title="Click to adjust"
                              >
                                {isOut ? (
                                  <XCircle className="h-3 w-3" />
                                ) : isLow ? (
                                  <AlertTriangle className="h-3 w-3" />
                                ) : (
                                  <CheckCircle2 className="h-3 w-3" />
                                )}
                                {p.stock} in stock
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center text-sm text-gray-600 dark:text-gray-300">
                        {p.lowStockThreshold}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                            p.status === 'active'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                              : p.status === 'draft'
                              ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          )}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!p.allowBackorder && isOut && (
                            <button
                              onClick={() => quickRestock(p)}
                              disabled={isSaving}
                              className="rounded-md border border-amber-300 dark:border-amber-700 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 disabled:opacity-50"
                              title="Restock to 2× threshold"
                            >
                              {isSaving ? '…' : 'Restock'}
                            </button>
                          )}
                          <Link
                            href={`/admin/products/${p.slug}`}
                            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Edit product"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <Link
                            href={`/product/${p.slug}`}
                            target="_blank"
                            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="View in store"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-6 py-3">
            <p className="text-sm text-gray-500">
              Page {page} of {pages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}