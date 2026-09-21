'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Layers, Tag, Wallet, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreferredCategory {
  id: string;
  name: string;
  score: number;
}

interface TasteProfile {
  categoryAffinity: Record<string, number>;
  tagAffinity: Record<string, number>;
  priceTier: 'budget' | 'mid' | 'premium' | 'unknown';
  engagementScore: number;
  preferredCategories: PreferredCategory[];
  preferredTags: string[];
  insight: string;
}

const tierLabel: Record<string, string> = {
  budget: 'Budget',
  mid: 'Mid-Range',
  premium: 'Premium',
  unknown: 'Discovering',
};

const tierIcon: Record<string, string> = {
  budget: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  mid: 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300',
  premium: 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
  unknown: 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

/**
 * AI Taste Profile card — shows what the AI has learned about this shopper
 * (top categories, tags, price tier, engagement) with a sparkle badge.
 */
export default function TasteProfileCard({ className }: { className?: string }) {
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/user/ai-profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.profile) setProfile(data.profile);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 animate-pulse', className)}>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    );
  }

  if (!profile || profile.engagementScore === 0) {
    return (
      <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6', className)}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-gray-900 dark:text-white">AI Taste Profile</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Browse, wishlist or order a few products and our AI will learn your taste — you&apos;ll see personalized picks here.
        </p>
      </div>
    );
  }

  const gaugeColor =
    profile.engagementScore >= 60
      ? 'bg-emerald-500'
      : profile.engagementScore >= 25
        ? 'bg-amber-500'
        : 'bg-gray-400';

  return (
    <div className={cn('rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-gray-900 dark:text-white">AI Taste Profile</h3>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
          <Sparkles size={11} /> AI
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">{profile.insight}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Price tier */}
        <div className="flex items-start gap-3">
          <span className={cn('mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg', tierIcon[profile.priceTier])}>
            <Wallet className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Price tier</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{tierLabel[profile.priceTier]}</p>
          </div>
        </div>

        {/* Engagement */}
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
            <Gauge className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Signal strength</p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700">
                <div className={cn('h-1.5 rounded-full', gaugeColor)} style={{ width: `${profile.engagementScore}%` }} />
              </div>
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{profile.engagementScore}%</span>
            </div>
          </div>
        </div>

        {/* Preferred categories */}
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Favorite categories</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.preferredCategories.length > 0 ? (
              profile.preferredCategories.map((c) => (
                <span
                  key={c.name}
                  className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {c.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-400">No strong signals yet</span>
            )}
          </div>
        </div>

        {/* Preferred tags */}
        {profile.preferredTags.length > 0 && (
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">What you like</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.preferredTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs text-gray-600 dark:text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}