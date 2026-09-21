'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  ShieldAlert,
  Sparkles,
  ShieldCheck,
  Clock,
  RefreshCw,
  MessageSquareReply,
  Zap,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReviewRecord {
  reviewId: string;
  product: { _id: string; name: string; slug: string };
  user: { _id?: string; name: string; email?: string; avatar?: string } | null;
  rating: number;
  title?: string;
  comment: string;
  isApproved: boolean;
  isVerifiedPurchase: boolean;
  moderation?: {
    sentiment?: string;
    toxicity_score?: number;
    flags?: string[];
    recommendedAction?: string;
    analyzedAt?: string;
  };
  reply?: string;
  repliedBy?: { _id?: string; name: string } | null;
  repliedAt?: string;
  createdAt: string;
}

interface Counts {
  pending: number;
  flagged: number;
  approved: number;
  total: number;
}

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'pending', label: 'Needs Review' },
  { value: 'flagged', label: 'Flagged (AI)' },
  { value: 'approved', label: 'Approved' },
  { value: 'all', label: 'All' },
];

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  negative: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn(
            'h-3.5 w-3.5',
            index < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'
          )}
        />
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Seller-reply drafting state
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyNotice, setReplyNotice] = useState<string | null>(null);

  const fetchReviews = async (filter: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ status: filter === 'all' ? 'all' : filter, limit: '200' });
      const response = await fetch(`/api/admin/reviews?${params}`);
      const data = await response.json();
      if (Array.isArray(data.reviews)) setReviews(data.reviews);
      if (data.counts) setCounts(data.counts);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(status);
  }, [status]);

  const act = async (
    productId: string,
    reviewId: string,
    action: 'approve' | 'reject' | 'delete'
  ) => {
    setBusyId(reviewId);
    try {
      const response =
        action === 'delete'
          ? await fetch('/api/admin/reviews', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productId, reviewId }),
            })
          : await fetch('/api/admin/reviews', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productId, reviewId, action }),
            });
      if (response.ok) {
        await fetchReviews(status);
      }
    } catch (error) {
      console.error('Failed to update review:', error);
    } finally {
      setBusyId(null);
    }
  };

  const draftReply = async (review: ReviewRecord) => {
    setBusyId(review.reviewId);
    setReplyNotice(null);
    try {
      const response = await fetch('/api/admin/ai-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reviewReply',
          reviewText: review.comment,
          rating: review.rating,
          productName: review.product.name,
          customerName: review.user?.name || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setReplyNotice(`Draft failed: ${data.error || 'unknown error'}`);
        return;
      }
      if (!data.result?.reply) {
        setReplyNotice('Could not draft a reply right now.');
        return;
      }
      setReplyTexts((prev) => ({ ...prev, [review.reviewId]: data.result.reply }));
    } catch (error) {
      console.error('Failed to draft reply:', error);
      setReplyNotice('Network error while drafting.');
    } finally {
      setBusyId(null);
    }
  };

  const saveReply = async (review: ReviewRecord) => {
    const reply = (replyTexts[review.reviewId] || '').trim();
    if (!reply) {
      setReplyNotice('Write a reply first (or press "Draft with AI").');
      return;
    }
    setBusyId(review.reviewId);
    setReplyNotice(null);
    try {
      const response = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: review.product._id,
          reviewId: review.reviewId,
          action: 'reply',
          reply,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setReplyNotice(`Save failed: ${data.error || 'unknown error'}`);
        return;
      }
      setReplyNotice('Reply published ✅');
      setReplyingId(null);
      await fetchReviews(status);
    } catch (error) {
      console.error('Failed to save reply:', error);
      setReplyNotice('Network error while saving.');
    } finally {
      setBusyId(null);
    }
  };

  const getRiskBadge = (review: ReviewRecord) => {
    const action = review.moderation?.recommendedAction;
    const toxicity = review.moderation?.toxicity_score ?? 0;
    if (action === 'flag' || toxicity >= 0.5) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
          <ShieldAlert className="h-3 w-3" /> Flagged
        </span>
      );
    }
    if (action === 'review' || toxicity >= 0.25) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          <Clock className="h-3 w-3" /> Review
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
        <ShieldCheck className="h-3 w-3" /> Clean
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Review Intelligence</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            AI-moderated customer reviews. Approve, reject or delete flagged content.
          </p>
        </div>
        <button
          onClick={() => fetchReviews(status)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Status tabs with counts */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const count = tab.value === 'all' ? counts?.total : counts?.[tab.value as keyof Counts];
          return (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                status === tab.value
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
              )}
            >
              {tab.label}
              {count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px]',
                    status === tab.value ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {replyNotice && (
        <p className="rounded-lg bg-blue-50 px-4 py-2.5 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {replyNotice}
        </p>
      )}

      {/* Reviews list */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="mt-3 h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-500 dark:text-gray-400">
              No reviews in this queue. The AI review engine will screen new submissions here.
            </p>
          </div>
        ) : (
          reviews.map((review) => (
            <motion.div
              key={review.reviewId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/products/${review.product.slug}`}
                      className="truncate font-medium text-primary hover:underline"
                    >
                      {review.product.name}
                    </Link>
                    <Stars rating={review.rating} />
                    <span className="text-xs text-gray-400">{review.rating}/5</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        review.isApproved
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      )}
                    >
                      {review.isApproved ? 'Approved' : 'Pending'}
                    </span>
                    {review.isVerifiedPurchase && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        Verified Purchase
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-gray-900 dark:text-white">
                    {review.title && <span className="font-medium">{review.title} — </span>}
                    <button
                      onClick={() =>
                        setExpandedId(expandedId === review.reviewId ? null : review.reviewId)
                      }
                      className="text-left"
                    >
                      {expandedId === review.reviewId || review.comment.length <= 160
                        ? review.comment
                        : `${review.comment.slice(0, 160)}…`}
                    </button>
                  </p>

                  <p className="mt-2 text-xs text-gray-400">
                    By {review.user?.name || 'Unknown customer'}
                    {review.user?.email ? ` · ${review.user.email}` : ''} ·{' '}
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>

                  {review.reply && (
                    <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900 border-l-2 border-primary">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                        <Zap className="h-3 w-3" />
                        Seller reply
                        {review.repliedBy?.name ? ` by ${review.repliedBy.name}` : ''}
                        {review.repliedAt &&
                          ` · ${new Date(review.repliedAt).toLocaleDateString()}`}
                      </p>
                      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                        {review.reply}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  {getRiskBadge(review)}
                  {review.moderation && (
                    <>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                          SENTIMENT_STYLES[review.moderation.sentiment || 'neutral']
                        )}
                      >
                        <Sparkles className="h-3 w-3" /> {review.moderation.sentiment || 'neutral'}
                        {review.moderation.toxicity_score != null &&
                          ` · ${(review.moderation.toxicity_score * 100).toFixed(0)}% toxic`}
                      </span>
                      {review.moderation.flags && review.moderation.flags.length > 0 && (
                        <span className="max-w-52 text-right text-[11px] text-red-500">
                          {review.moderation.flags.join(', ')}
                        </span>
                      )}
                    </>
                  )}
                  <div className="flex items-center gap-1.5">
                    {!review.isApproved && (
                      <button
                        onClick={() => act(review.product._id, review.reviewId, 'approve')}
                        disabled={busyId === review.reviewId}
                        className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                    {review.isApproved && (
                      <button
                        onClick={() => act(review.product._id, review.reviewId, 'reject')}
                        disabled={busyId === review.reviewId}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-40"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" /> Take down
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setReplyingId(replyingId === review.reviewId ? null : review.reviewId)
                      }
                      disabled={busyId === review.reviewId}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                        replyingId === review.reviewId
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                      )}
                    >
                      <MessageSquareReply className="h-3.5 w-3.5" /> Reply
                    </button>
                    <button
                      onClick={() => act(review.product._id, review.reviewId, 'delete')}
                      disabled={busyId === review.reviewId}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>

              {replyingId === review.reviewId && (
                <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
                  <textarea
                    value={replyTexts[review.reviewId] || ''}
                    onChange={(e) =>
                      setReplyTexts((prev) => ({
                        ...prev,
                        [review.reviewId]: e.target.value,
                      }))
                    }
                    maxLength={2000}
                    rows={3}
                    placeholder="Write a reply in your brand voice — or let AI draft one for you…"
                    className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => draftReply(review)}
                      disabled={busyId === review.reviewId}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-40"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {busyId === review.reviewId ? 'Drafting…' : 'Draft with AI'}
                    </button>
                    <button
                      onClick={() => saveReply(review)}
                      disabled={busyId === review.reviewId}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
                    >
                      <MessageSquareReply className="h-3.5 w-3.5" /> Save reply
                    </button>
                    <button
                      onClick={() => setReplyingId(null)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}