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
  Newspaper,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Post {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage?: string;
  category?: string;
  tags?: string[];
  authorName?: string;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: string;
  viewCount: number;
  aiGenerated?: boolean;
}

const statusTabs = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'published', label: 'Published' },
  { id: 'archived', label: 'Archived' },
] as const;

type StatusFilter = (typeof statusTabs)[number]['id'];

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary';
const labelCls =
  'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const emptyForm = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  category: 'Shopping',
  tags: '',
  featuredImage: '',
  status: 'draft' as 'draft' | 'published' | 'archived',
  metaTitle: '',
  metaDescription: '',
};

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: filter });
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/admin/blog?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (error) {
      console.error('Failed to load posts:', error);
      setMessage('⚠️ Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    const t = setTimeout(loadPosts, 300);
    return () => clearTimeout(t);
  }, [loadPosts]);

  const openNew = () => {
    setSelectedId(null);
    setForm({ ...emptyForm });
    setMessage('');
  };

  const openPost = async (id: string) => {
    try {
      setMessage('');
      const res = await fetch(`/api/admin/blog/${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.post) {
        setMessage(`⚠️ ${data.error || 'Failed to load post'}`);
        return;
      }
      const p = data.post;
      setSelectedId(id);
      setForm({
        title: p.title || '',
        slug: p.slug || '',
        excerpt: p.excerpt || '',
        content: p.content || '',
        category: p.category || 'Shopping',
        tags: (p.tags || []).join(', '),
        featuredImage: p.featuredImage || '',
        status: p.status || 'draft',
        metaTitle: p.metaTitle || '',
        metaDescription: p.metaDescription || '',
      });
    } catch (error) {
      console.error(error);
      setMessage('⚠️ Failed to load post');
    }
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
      const payload = {
        ...form,
        slug: form.slug.trim() || undefined,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const res = selectedId
        ? await fetch(`/api/admin/blog/${selectedId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/blog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save post');
      setMessage(
        `✅ ${selectedId ? 'Post updated' : 'Post created'} (${form.status})`
      );
      if (!selectedId && data.post?._id) {
        setSelectedId(data.post._id);
        setForm((f) => ({ ...f, slug: data.post.slug || f.slug }));
      }
      loadPosts();
    } catch (error: any) {
      setMessage(`⚠️ ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm('Delete this post permanently?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/blog/${selectedId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setMessage('✅ Post deleted');
      openNew();
      loadPosts();
    } catch (error: any) {
      setMessage(`⚠️ ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (p: Post, status: string) => {
    try {
      const res = await fetch(`/api/admin/blog/${p._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      if (selectedId === p._id) setForm((f) => ({ ...f, status: status as any }));
      loadPosts();
    } catch (error: any) {
      setMessage(`⚠️ ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Blog Posts
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage articles, AI drafts from Content Studio, and published posts.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New Post
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
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-3">
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-1">
                {statusTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1 text-xs font-medium',
                      filter === tab.id
                        ? 'bg-primary text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search posts…"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <div className="max-h-[calc(100vh-320px)] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
              {loading && (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  Loading…
                </div>
              )}
              {!loading && posts.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No posts found.
                </div>
              )}
              {!loading &&
                posts.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => openPost(p._id)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                      selectedId === p._id &&
                        'bg-primary/5 dark:bg-primary/10'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
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
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                      {p.excerpt || p.slug}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-400">
                      <span>{p.category || '—'}</span>
                      {p.aiGenerated && <span>✨ AI</span>}
                      <span>{p.viewCount ?? 0} views</span>
                    </div>
                    {p.status === 'draft' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          quickStatus(p, 'published');
                        }}
                        className="mt-2 rounded-md bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-green-700"
                      >
                        Publish
                      </button>
                    )}
                    {p.status === 'published' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          quickStatus(p, 'archived');
                        }}
                        className="mt-2 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-0.5 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Archive
                      </button>
                    )}
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
              {selectedId ? 'Edit Post' : 'New Post'}
            </h2>
            {selectedId && (
              <div className="flex items-center gap-1">
                <Link
                  href={`/blog/${form.slug}`}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Category</label>
                <input
                  className={inputCls}
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Tags (comma separated)</label>
                <input
                  className={inputCls}
                  value={form.tags}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tags: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  className={inputCls}
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as any,
                    }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Featured Image URL</label>
              <input
                className={inputCls}
                value={form.featuredImage}
                placeholder="https://…"
                onChange={(e) =>
                  setForm((f) => ({ ...f, featuredImage: e.target.value }))
                }
              />
            </div>

            <div>
              <label className={labelCls}>Excerpt</label>
              <textarea
                rows={2}
                className={inputCls}
                value={form.excerpt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, excerpt: e.target.value }))
                }
              />
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
                {selectedId ? 'Save Changes' : 'Create Post'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}