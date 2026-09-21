'use client';

import { useEffect, useState } from 'react';
import { Sparkles, FileText, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReviewSummaryResult {
  summary: string;
  summary_source: 'llm' | 'extractive';
  key_points: string[];
  sentiment_mix: Record<string, number>;
  average_rating?: number | null;
  generated_at: string;
}

interface ReviewSummaryCardProps {
  productId: string;
  productName: string;
}

const SENTIMENT_META: Record<
  string,
  { label: string; icon: typeof ThumbsUp; className: string; bar: string }
> = {
  positive: {
    label: 'Positive',
    icon: ThumbsUp,
    className: 'text-green-600 dark:text-green-400',
    bar: 'bg-green-500',
  },
  neutral: {
    label: 'Neutral',
    icon: Minus,
    className: 'text-gray-500 dark:text-gray-400',
    bar: 'bg-gray-400',
  },
  negative: {
    label: 'Negative',
    icon: ThumbsDown,
    className: 'text-red-600 dark:text-red-400',
    bar: 'bg-red-500',
  },
};

export default function ReviewSummaryCard({ productId, productName }: ReviewSummaryCardProps) {
  const [result, setResult] = useState<ReviewSummaryResult | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/reviews/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        });
        const data = await response.json();
        if (!cancelled && response.ok) {
          setResult(data);
        } else if (!cancelled) {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-3">
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 w-4/5 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (error || !result) return null;

  const mixTotal = Object.values(result.sentiment_mix || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-gray-900 dark:text-white">AI Review Summary</h3>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
          <FileText className="h-3 w-3" />
          {result.summary_source === 'llm' ? 'LLM' : 'Extractive'}
        </span>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{result.summary}</p>

      {result.key_points?.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {result.key_points.slice(0, 4).map((point, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}

      {mixTotal > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {Object.entries(SENTIMENT_META).map(([key, meta]) => {
            const count = result.sentiment_mix?.[key] || 0;
            const pct = mixTotal > 0 ? Math.round((count / mixTotal) * 100) : 0;
            const Icon = meta.icon;
            return (
              <div key={key} className="rounded-lg bg-white/70 dark:bg-gray-800/70 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Icon className={cn('h-3.5 w-3.5', meta.className)} />
                  <span className={cn(meta.className)}>{meta.label}</span>
                </div>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{pct}%</p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className={cn('h-full rounded-full', meta.bar)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] text-gray-400">
        Generated from {productName} customer reviews by the Pakistani Noor AI assistant.
      </p>
    </div>
  );
}