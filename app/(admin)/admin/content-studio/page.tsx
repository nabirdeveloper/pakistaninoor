'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Mail,
  Bell,
  MessageSquare,
  FileText,
  PenLine,
  Save,
  BookMarked,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'friendly' | 'professional' | 'urgent' | 'celebratory';
type Tool = 'campaign' | 'blog';

interface CampaignResult {
  email: { subject: string; body: string; cta: string };
  push: { title: string; body: string };
  sms: { body: string };
  engine: string;
  generated_at: string;
  source?: string;
}

interface BlogDraftResult {
  title: string;
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  outline: string[];
  sections: Array<{ heading: string; content: string }>;
  engine: string;
  generated_at: string;
  source?: string;
  savedAsDraft?: boolean;
}

interface SavedDraft {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  createdAt: string;
}

const TONES: Array<{ id: Tone; label: string }> = [
  { id: 'friendly', label: 'Friendly' },
  { id: 'professional', label: 'Professional' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'celebratory', label: 'Celebratory' },
];

const TONE_DESCRIPTIONS: Record<Tone, string> = {
  friendly: 'Warm, personal, casual',
  professional: 'Polished, formal, trustworthy',
  urgent: 'Scarcity, deadline-driven',
  celebratory: 'Festive, joyful, high-energy',
};

const CHANNELS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'push', label: 'Push', icon: Bell },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
] as const;

export default function AdminContentStudioPage() {
  const [tool, setTool] = useState<Tool>('campaign');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Content Studio</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Draft campaign copy and blog posts in seconds. Generated locally when the AI service is
            offline; upgraded to LLM output when a key is configured.
          </p>
        </div>
      </div>

      {/* Tool tabs */}
      <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
        <button
          onClick={() => setTool('campaign')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tool === 'campaign'
              ? 'bg-primary text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          )}
        >
          <MegaphoneSmall /> Campaign Copy
        </button>
        <button
          onClick={() => setTool('blog')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            tool === 'blog'
              ? 'bg-primary text-white'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
          )}
        >
          <FileText className="h-4 w-4" /> Blog Drafts
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tool === 'campaign' ? (
          <CampaignTool key="campaign" />
        ) : (
          <BlogTool key="blog" />
        )}
      </AnimatePresence>
    </div>
  );
}

function MegaphoneSmall() {
  return <Sparkles className="h-4 w-4" />;
}

// ---------------------------------------------------------------------------
// Campaign tool
// ---------------------------------------------------------------------------

function CampaignTool() {
  const [productName, setProductName] = useState('');
  const [offer, setOffer] = useState('');
  const [audience, setAudience] = useState('');
  const [deadline, setDeadline] = useState('');
  const [tone, setTone] = useState<Tone>('friendly');
  const [channels, setChannels] = useState<Array<'email' | 'push' | 'sms'>>(['email', 'push']);
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/content-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'campaign',
          productName,
          offer,
          audience,
          deadline,
          tone,
          channels,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to generate copy');
        return;
      }
      setResult(data);
    } catch {
      setError('Network error while generating copy.');
    } finally {
      setLoading(false);
    }
  }, [productName, offer, audience, deadline, tone, channels]);

  const toggleChannel = (id: 'email' | 'push' | 'sms') => {
    setChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 gap-6 lg:grid-cols-5"
    >
      {/* Inputs */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Campaign details</h2>
        <Field label="Product / offer name" hint="e.g. Maslin Kurta — Eid Collection">
          <input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. Maslin Kurta — Eid Collection"
            className="input"
          />
        </Field>
        <Field label="Offer" hint="e.g. 20% off, Buy 1 Get 1">
          <input
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            placeholder="e.g. 20% off"
            className="input"
          />
        </Field>
        <Field label="Audience" hint="e.g. first-time shoppers, VIP members">
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. first-time shoppers"
            className="input"
          />
        </Field>
        <Field label="Deadline (optional)">
          <input
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            placeholder="e.g. this weekend / until Eid"
            className="input"
          />
        </Field>

        <div>
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Tone</p>
          <div className="grid grid-cols-2 gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  tone === t.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                <span className="block font-medium">{t.label}</span>
                <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                  {TONE_DESCRIPTIONS[t.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Channels</p>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((c) => {
              const active = channels.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleChannel(c.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                  )}
                >
                  <c.icon className="h-3.5 w-3.5" /> {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Writing…' : 'Generate campaign copy'}
        </button>
      </div>

      {/* Output */}
      <div className="space-y-4 lg:col-span-3">
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </p>
        )}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="mt-3 h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        )}
        {!loading && result && (
          <ResultPanel
            engine={result.engine}
            generatedAt={result.generated_at}
            source={result.source}
          >
            {channels.includes('email') && (
              <CopyBlock
                title="Email"
                icon={Mail}
                copied={copied}
                copyKey="email"
                onCopy={copyText}
                copyText={`Subject: ${result.email.subject}\n\n${result.email.body}\n\nCTA: ${result.email.cta}`}
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {result.email.subject}
                </p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-gray-700 dark:text-gray-300">
                  {result.email.body}
                </pre>
                <p className="mt-3 text-xs font-medium text-violet-600 dark:text-violet-400">
                  CTA → {result.email.cta}
                </p>
              </CopyBlock>
            )}
            {channels.includes('push') && (
              <CopyBlock
                title="Push notification"
                icon={Bell}
                copied={copied}
                copyKey="push"
                onCopy={copyText}
                copyText={`Title: ${result.push.title}\n\n${result.push.body}`}
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {result.push.title}
                </p>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{result.push.body}</p>
              </CopyBlock>
            )}
            {channels.includes('sms') && (
              <CopyBlock
                title="SMS"
                icon={MessageSquare}
                copied={copied}
                copyKey="sms"
                onCopy={copyText}
                copyText={result.sms.body}
              >
                <p className="text-sm text-gray-700 dark:text-gray-300">{result.sms.body}</p>
                <p className="mt-2 text-[11px] text-gray-400">{result.sms.body.length} characters</p>
              </CopyBlock>
            )}
          </ResultPanel>
        )}
        {!loading && !result && !error && (
          <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="text-center">
              <Sparkles className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Fill in the campaign details and press generate — email, push and SMS drafts will
                appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Blog tool
// ---------------------------------------------------------------------------

function BlogTool() {
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [audience, setAudience] = useState('');
  const [category, setCategory] = useState('Shopping');
  const [saveDraft, setSaveDraft] = useState(true);
  const [result, setResult] = useState<BlogDraftResult | null>(null);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/content-studio');
      const data = await response.json();
      if (Array.isArray(data.drafts)) setDrafts(data.drafts);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/content-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'blog',
          topic,
          keywords: keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
          audience,
          category,
          saveDraft,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to generate blog draft');
        return;
      }
      setResult(data);
      if (data.savedAsDraft) fetchDrafts();
    } catch {
      setError('Network error while generating blog draft.');
    } finally {
      setLoading(false);
    }
  }, [topic, keywords, audience, category, saveDraft, fetchDrafts]);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const fullMarkdown =
    result && result.sections
      ? `# ${result.title}\n\n${result.excerpt}\n\n${result.sections
          .map((s) => `## ${s.heading}\n\n${s.content}`)
          .join('\n\n')}`
      : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 gap-6"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Inputs */}
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Blog draft</h2>
          <Field label="Topic" hint="What is the post about?">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. How to choose a quality blender"
              className="input"
            />
          </Field>
          <Field label="Keywords (comma separated)">
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. blender price bangladesh, best blender"
              className="input"
            />
          </Field>
          <Field label="Audience (optional)">
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. first-time kitchen appliance buyers"
              className="input"
            />
          </Field>
          <Field label="Category">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Shopping"
              className="input"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={saveDraft}
              onChange={(e) => setSaveDraft(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Save className="h-3.5 w-3.5" /> Save as a draft post automatically
          </label>

          <button
            onClick={generate}
            disabled={loading || !topic.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
            {loading ? 'Writing…' : 'Generate blog draft'}
          </button>
        </div>

        {/* Output */}
        <div className="space-y-4 lg:col-span-3">
          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="mt-3 h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          )}
          {!loading && result && (
            <ResultPanel
              engine={result.engine}
              generatedAt={result.generated_at}
              source={result.source}
            >
              <CopyBlock
                title="Post (Markdown)"
                icon={FileText}
                copied={copied}
                copyKey="post"
                onCopy={copyText}
                copyText={fullMarkdown}
              >
                <p className="text-lg font-bold text-gray-900 dark:text-white">{result.title}</p>
                {result.savedAsDraft && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                    <Check className="h-3 w-3" /> Saved as draft (/{result.slug})
                  </p>
                )}
                <p className="mt-2 text-sm italic text-gray-600 dark:text-gray-300">{result.excerpt}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(result.keywords || []).map((k) => (
                    <span
                      key={k}
                      className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </CopyBlock>

              <CopyBlock
                title="SEO metadata"
                icon={FileText}
                copied={copied}
                copyKey="seo"
                onCopy={copyText}
                copyText={`Meta title: ${result.metaTitle}\n\nMeta description: ${result.metaDescription}\n\nKeywords: ${(result.keywords || []).join(', ')}`}
              >
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{result.metaTitle}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{result.metaDescription}</p>
              </CopyBlock>

              <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Outline</p>
                  <button
                    onClick={() => copyText('outline', result.outline.join('\n'))}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {copied === 'outline' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy
                  </button>
                </div>
                <ol className="mt-3 list-inside list-decimal space-y-1.5">
                  {(result.outline || []).map((h) => (
                    <li key={h} className="text-sm text-gray-600 dark:text-gray-300">
                      {h}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="space-y-3">
                {(result.sections || []).map((s) => (
                  <div
                    key={s.heading}
                    className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.heading}</p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                      {s.content}
                    </p>
                  </div>
                ))}
              </div>
            </ResultPanel>
          )}
          {!loading && !result && !error && (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="text-center">
                <BookMarked className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  Enter a topic to generate a first-draft blog post with outline, SEO metadata and
                  editable sections.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saved drafts */}
      {drafts.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Recently saved AI drafts
            </h2>
            <button
              onClick={fetchDrafts}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
          <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
            {drafts.map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{d.title}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    /{d.slug} · {d.category} · {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  Draft
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Shared atoms
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

function ResultPanel({
  engine,
  generatedAt,
  source,
  children,
}: {
  engine: string;
  generatedAt: string;
  source?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-medium',
            source === 'ai_service'
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
          )}
        >
          <Sparkles className="mr-1 inline h-3 w-3" />
          {source === 'ai_service' ? 'LLM' : 'Local template engine'}
        </span>
        <span className="text-[11px] text-gray-400">
          {new Date(generatedAt).toLocaleString()}
        </span>
      </div>
      {children}
    </div>
  );
}

function CopyBlock({
  title,
  icon: Icon,
  copied,
  copyKey,
  onCopy,
  copyText,
  children,
}: {
  title: string;
  icon: typeof Mail;
  copied: string | null;
  copyKey: string;
  onCopy: (key: string, text: string) => void;
  copyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </p>
        <button
          onClick={() => onCopy(copyKey, copyText)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {copied === copyKey ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied === copyKey ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}