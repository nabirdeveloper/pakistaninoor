'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Save,
  Trash2,
  Eye,
  Loader2,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CmsPage {
  _id: string;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  metaTitle?: string;
  metaDescription?: string;
  updatedAt: string;
}

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary';
const labelCls =
  'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const emptyForm = {
  title: '',
  slug: '',
  content: '',
  status: 'draft' as 'draft' | 'published' | 'archived',
  metaTitle: '',
  metaDescription: '',
};

export default function AdminPagesPage() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/admin/pages?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      setPages(data.pages || []);
    } catch (error) {
      console.error('Failed to load pages:', error);
      setMessage('⚠️ Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const openNew = () => {
    setSelectedId(null);
    setForm({ ...emptyForm });
    setMessage('');
  };

  const openPage = (p: CmsPage) => {
    setSelectedId(p._id);
    setForm({
      title: p.title || '',
      slug: p.slug || '',
      content: p.content || '',
      status: p.status || 'draft',
      metaTitle: p.metaTitle || '',
      metaDescription: p.metaDescription || '',
    });
    setMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setMessage('⚠️ Title and content are required');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const payload = { ...form, slug: form.slug.trim() || undefined };
      const res = selectedId
        ? await fetch(`/api/admin/pages/${selectedId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/pages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save page');
      setMessage(
        `✅ ${selectedId ? 'Page updated' : 'Page created'} (${form.status})`
      );
      if (!selectedId && data.page?._id) {
        setSelectedId(data.page._id);
        setForm((f) => ({ ...f, slug: data.page.slug || f.slug }));
      }
      load();
    } catch (error: any) {
      setMessage(`⚠️ ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm('Delete this page permanently?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pages/${selectedId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setMessage('✅ Page deleted');
      openNew();
      load();
    } catch (error: any) {
      setMessage(`⚠️ ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pages
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage storefront pages like About, Privacy Policy and Terms.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New Page
        </button>
      </div>

      {message && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* List */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pages…"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading && (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  Loading…
                </div>
              )}
              {!loading && pages.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No pages yet.
                </div>
              )}
              {!loading &&
                pages.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => openPage(p)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                      selectedId === p._id && 'bg-primary/5 dark:bg-primary/10'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {p.title}
                      </p>
                      <span
                        className={cn(
                          'flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase',
                          p.status === 'published'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : p.status === 'archived'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        )}
                      >
                        {p.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">/{p.slug}</p>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Editor */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedId ? 'Edit Page' : 'New Page'}
            </h2>
            {selectedId && (
              <div className="flex items-center gap-1">
                <Link
                  href={`/pages/${form.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Eye className="h-3.5 w-3.5" /> View
                </Link>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 dark:border-red-800 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className={labelCls}>Title *</label>
                <input
                  required
                  className={inputCls}
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Slug</label>
                <input
                  className={inputCls}
                  value={form.slug}
                  placeholder="auto-generated"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={inputCls}
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as any }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>
                Content *{' '}
                <span className="text-xs font-normal text-gray-400">
                  (use ## for headings, - for bullet lists)
                </span>
              </label>
              <textarea
                required
                rows={14}
                className={cn(inputCls, 'font-mono text-xs leading-relaxed')}
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Meta Title</label>
                <input
                  className={inputCls}
                  value={form.metaTitle}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, metaTitle: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Meta Description</label>
                <input
                  className={inputCls}
                  value={form.metaDescription}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, metaDescription: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
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
                {selectedId ? 'Save Changes' : 'Create Page'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}