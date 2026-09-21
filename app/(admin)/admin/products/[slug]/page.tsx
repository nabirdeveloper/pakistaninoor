'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Trash2,
  ExternalLink,
  Loader2,
  Plus,
  X,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Category {
  _id: string;
  name: string;
  slug: string;
}

interface ProductImage {
  url: string;
  alt?: string;
}

interface ProductData {
  _id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  brand?: string;
  category?: Category | string;
  tags: string[];
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  sku: string;
  barcode?: string;
  stock: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  images: ProductImage[];
  status: string;
  visibility: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isOnSale: boolean;
  badges: string[];
  weight?: number;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string[] | string;
  };
}

const tabs = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'media', label: 'Media' },
  { id: 'pricing', label: 'Pricing & Inventory' },
  { id: 'seo', label: 'SEO' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function EditProductPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    shortDescription: '',
    description: '',
    brand: '',
    category: '',
    tags: [] as string[],
    price: '',
    compareAtPrice: '',
    costPrice: '',
    sku: '',
    barcode: '',
    stock: '0',
    lowStockThreshold: '10',
    trackInventory: true,
    allowBackorder: false,
    status: 'draft',
    visibility: 'visible',
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
    isOnSale: false,
    badges: [] as string[],
    weight: '',
    images: [] as ProductImage[],
    metaTitle: '',
    metaDescription: '',
    metaKeywords: '',
  });

  const [tagInput, setTagInput] = useState('');
  const [badgeInput, setBadgeInput] = useState('');

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const load = async () => {
      try {
        const [productRes, catRes] = await Promise.all([
          fetch(`/api/admin/products/${slug}`, { cache: 'no-store' }),
          fetch('/api/categories'),
        ]);
        const productData = await productRes.json();
        const catData = await catRes.json();

        if (!productRes.ok) {
          setError(productData.error || 'Product not found');
          return;
        }

        const p: ProductData = productData.product;
        setCategories(catData.categories || []);
        setForm({
          name: p.name || '',
          slug: p.slug || '',
          shortDescription: p.shortDescription || '',
          description: p.description || '',
          brand: p.brand || '',
          category:
            typeof p.category === 'object' && p.category?._id
              ? p.category._id
              : typeof p.category === 'string'
              ? p.category
              : '',
          tags: p.tags || [],
          price: String(p.price ?? ''),
          compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : '',
          costPrice: p.costPrice ? String(p.costPrice) : '',
          sku: p.sku || '',
          barcode: p.barcode || '',
          stock: String(p.stock ?? 0),
          lowStockThreshold: String(p.lowStockThreshold ?? 10),
          trackInventory: p.trackInventory ?? true,
          allowBackorder: p.allowBackorder ?? false,
          status: p.status || 'draft',
          visibility: p.visibility || 'visible',
          isFeatured: !!p.isFeatured,
          isNewArrival: !!p.isNewArrival,
          isBestSeller: !!p.isBestSeller,
          isOnSale: !!p.isOnSale,
          badges: p.badges || [],
          weight: p.weight ? String(p.weight) : '',
          images: (p.images || []).map((img) => ({
            url: img.url,
            alt: img.alt || '',
          })),
          metaTitle: p.seo?.metaTitle || '',
          metaDescription: p.seo?.metaDescription || '',
          metaKeywords: Array.isArray(p.seo?.metaKeywords)
            ? p.seo!.metaKeywords!.join(', ')
            : p.seo?.metaKeywords || '',
        });
      } catch (e: any) {
        setError(e.message || 'Failed to load product');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  };

  const addBadge = () => {
    const b = badgeInput.trim();
    if (b && !form.badges.includes(b)) set('badges', [...form.badges, b]);
    setBadgeInput('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.url) {
          set('images', [...form.images, { url: data.url, alt: '' }]);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        shortDescription: form.shortDescription,
        description: form.description,
        brand: form.brand || undefined,
        category: form.category || undefined,
        tags: form.tags,
        price: parseFloat(form.price) || 0,
        compareAtPrice: form.compareAtPrice
          ? parseFloat(form.compareAtPrice)
          : undefined,
        costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
        sku: form.sku.trim(),
        barcode: form.barcode || undefined,
        stock: parseInt(form.stock, 10) || 0,
        lowStockThreshold: parseInt(form.lowStockThreshold, 10) || 10,
        trackInventory: form.trackInventory,
        allowBackorder: form.allowBackorder,
        status: form.status,
        visibility: form.visibility,
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
        isBestSeller: form.isBestSeller,
        isOnSale: form.isOnSale,
        badges: form.badges,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        images: form.images,
        seo: {
          metaTitle: form.metaTitle || undefined,
          metaDescription: form.metaDescription || undefined,
          metaKeywords: form.metaKeywords
            ? form.metaKeywords
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean)
            : [],
        },
      };

      const res = await fetch(`/api/admin/products/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save product');
      setSuccess('Product saved');
      // Keep URL in sync if slug changed
      if (data.product?.slug && data.product.slug !== slug) {
        router.replace(`/admin/products/${data.product.slug}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this product permanently? This cannot be undone.'))
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${slug}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete product');
      }
      router.push('/admin/products');
    } catch (err: any) {
      setError(err.message || 'Failed to delete product');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error && !form.name) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-sm text-red-700 dark:text-red-300">
        <p className="font-medium">{error}</p>
        <Link
          href="/admin/products"
          className="mt-3 inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to products
        </Link>
      </div>
    );
  }

  const inputCls =
    'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary';
  const labelCls =
    'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/admin/products"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Products
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Product
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/product/${slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ExternalLink className="h-4 w-4" /> View in Store
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {(error || success) && (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            success
              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          )}
        >
          {success || error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'basic' && (
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Product Name *</label>
              <input
                required
                className={inputCls}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Slug</label>
              <input
                className={inputCls}
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>SKU *</label>
              <input
                required
                className={inputCls}
                value={form.sku}
                onChange={(e) => set('sku', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Barcode</label>
              <input
                className={inputCls}
                value={form.barcode}
                onChange={(e) => set('barcode', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Brand</label>
              <input
                className={inputCls}
                value={form.brand}
                onChange={(e) => set('brand', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select
                className={inputCls}
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
              >
                <option value="">— No category —</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={inputCls}
                value={form.status}
                onChange={(e) => set('status', e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Visibility</label>
            <select
              className={inputCls}
              value={form.visibility}
              onChange={(e) => set('visibility', e.target.value)}
            >
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
              <option value="catalog">Catalog only</option>
              <option value="search">Search only</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ['isFeatured', 'Featured'],
                ['isNewArrival', 'New Arrival'],
                ['isBestSeller', 'Best Seller'],
                ['isOnSale', 'On Sale'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => set(key, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Short Description</label>
              <textarea
                rows={2}
                className={inputCls}
                value={form.shortDescription}
                onChange={(e) => set('shortDescription', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Tags</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={cn(inputCls, 'flex-1')}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add tag…"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {form.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs text-gray-700 dark:text-gray-200"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() =>
                          set('tags', form.tags.filter((x) => x !== t))
                        }
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className={labelCls}>Full Description</label>
            <textarea
              rows={6}
              className={inputCls}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
        </div>
      )}

      {activeTab === 'media' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <label className={labelCls}>Product Images</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageUpload}
            className="mb-4 block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:opacity-90"
          />
          {uploading && (
            <p className="mb-4 text-sm text-gray-500">Uploading…</p>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {form.images.map((img, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt || form.name}
                  className="h-28 w-full object-cover"
                />
                <div className="absolute right-1 top-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        'images',
                        form.images.filter((_, idx) => idx !== i)
                      )
                    }
                    className="rounded bg-red-500/90 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  value={img.alt || ''}
                  onChange={(e) =>
                    set(
                      'images',
                      form.images.map((im, idx) =>
                        idx === i ? { ...im, alt: e.target.value } : im
                      )
                    )
                  }
                  placeholder="Alt text"
                  className="w-full border-t border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 focus:outline-none"
                />
              </div>
            ))}
            <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:border-primary hover:text-primary">
              <Upload className="h-6 w-6" />
              <span className="mt-1 text-xs">Add image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
          </div>
        </div>
      )}

      {activeTab === 'pricing' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Price (৳) *</label>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                className={inputCls}
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Compare-at Price (৳)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputCls}
                value={form.compareAtPrice}
                onChange={(e) => set('compareAtPrice', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Cost Price (৳)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputCls}
                value={form.costPrice}
                onChange={(e) => set('costPrice', e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Stock Quantity</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.stock}
                onChange={(e) => set('stock', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Low-stock Threshold</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.lowStockThreshold}
                onChange={(e) => set('lowStockThreshold', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Weight (kg)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputCls}
                value={form.weight}
                onChange={(e) => set('weight', e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.trackInventory}
                onChange={(e) => set('trackInventory', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary"
              />
              Track inventory
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.allowBackorder}
                onChange={(e) => set('allowBackorder', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary"
              />
              Allow backorders
            </label>
          </div>
          <div className="mt-4">
            <label className={labelCls}>Badges</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={cn(inputCls, 'flex-1')}
                value={badgeInput}
                onChange={(e) => setBadgeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addBadge();
                  }
                }}
                placeholder="Add badge (e.g. Hot Deal)…"
              />
              <button
                type="button"
                onClick={addBadge}
                className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {form.badges.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.badges.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    {b}
                    <button
                      type="button"
                      onClick={() =>
                        set('badges', form.badges.filter((x) => x !== b))
                      }
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'seo' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Meta Title</label>
              <input
                className={inputCls}
                value={form.metaTitle}
                onChange={(e) => set('metaTitle', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Meta Description</label>
              <textarea
                rows={3}
                className={inputCls}
                value={form.metaDescription}
                onChange={(e) => set('metaDescription', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Meta Keywords (comma separated)</label>
              <input
                className={inputCls}
                value={form.metaKeywords}
                onChange={(e) => set('metaKeywords', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </form>
  );
}