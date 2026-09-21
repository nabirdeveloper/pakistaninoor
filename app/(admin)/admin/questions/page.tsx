'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageSquare, Sparkles, Send, Clock, ShieldCheck, RefreshCw, Zap, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionRecord {
  questionId: string;
  product: { _id: string; name: string; slug: string };
  user: { _id?: string; name: string; email?: string } | null;
  question: string;
  answer?: string;
  answeredBy?: { _id?: string; name: string } | null;
  answeredAt?: string;
  createdAt: string;
}

interface Counts {
  pending: number;
  answered: number;
  total: number;
}

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'answered', label: 'Answered' },
];

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const fetchQuestions = useCallback(async (filter: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ status: filter, limit: '200' });
      const response = await fetch(`/api/admin/questions?${params}`);
      const data = await response.json();
      if (Array.isArray(data.questions)) setQuestions(data.questions);
      if (data.counts) setCounts(data.counts);
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions(status);
  }, [status, fetchQuestions]);

  const draftWithAI = async (question: QuestionRecord) => {
    setBusyId(question.questionId);
    setDraftNotice(null);
    try {
      const response = await fetch(`/api/admin/questions/${question.questionId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) {
        setDraftNotice(`Draft failed: ${data.error || 'unknown error'}`);
        return;
      }
      if (!data.answerable) {
        setDraftNotice(
          "AI couldn't draft this one confidently (it needs human judgement) — write the answer yourself."
        );
        return;
      }
      setAnswers((prev) => ({ ...prev, [question.questionId]: data.draft }));
    } catch (error) {
      console.error('Failed to draft answer:', error);
      setDraftNotice('Network error while drafting.');
    } finally {
      setBusyId(null);
    }
  };

  const saveAnswer = async (question: QuestionRecord) => {
    const answer = (answers[question.questionId] || '').trim();
    if (!answer) {
      setDraftNotice('Write an answer first (or press "Draft with AI").');
      return;
    }
    setBusyId(question.questionId);
    setDraftNotice(null);
    try {
      const response = await fetch(`/api/admin/questions/${question.questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });
      const data = await response.json();
      if (!response.ok) {
        setDraftNotice(`Save failed: ${data.error || 'unknown error'}`);
        return;
      }
      setDraftNotice('Answer published ✅');
      await fetchQuestions(status);
    } catch (error) {
      console.error('Failed to save answer:', error);
      setDraftNotice('Network error while saving.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Product Q&A</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Customer questions from product pages. Common questions are auto-answered by AI;
            answer the rest here — optionally with an AI-drafted reply.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchQuestions(status)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Status tabs with counts */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const count = counts?.[tab.value as keyof Counts];
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

      {draftNotice && (
        <p className="rounded-lg bg-blue-50 px-4 py-2.5 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {draftNotice}
        </p>
      )}

      {/* Questions list */}
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
        ) : questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
            <MessageSquare className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-gray-500 dark:text-gray-400">
              {status === 'pending'
                ? 'No pending questions. Questions that the AI cannot answer appear here.'
                : 'No answered questions yet.'}
            </p>
          </div>
        ) : (
          questions.map((question) => {
            const isAnswered = status === 'answered';
            const autoAnswered = isAnswered && !question.answeredBy;
            return (
              <motion.div
                key={question.questionId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/product/${question.product.slug}`}
                        target="_blank"
                        className="truncate font-medium text-primary hover:underline"
                      >
                        {question.product.name}
                      </Link>
                      {autoAnswered ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                          <Zap className="h-3 w-3" /> Auto-answered by AI
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                            isAnswered
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          )}
                        >
                          <Clock className="h-3 w-3" />
                          {isAnswered ? 'Answered' : 'Pending'}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                      “{question.question}”
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      <User className="mr-1 inline h-3 w-3" />
                      {question.user?.name || 'Unknown customer'}
                      {question.user?.email ? ` · ${question.user.email}` : ''} ·{' '}
                      {new Date(question.createdAt).toLocaleDateString()}
                    </p>

                    {isAnswered && question.answer && (
                      <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                          {autoAnswered ? (
                            <>
                              <Zap className="h-3 w-3" /> AI answer
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3" /> Answer by{' '}
                              {question.answeredBy?.name || 'Admin'}
                            </>
                          )}
                          {question.answeredAt &&
                            ` · ${new Date(question.answeredAt).toLocaleDateString()}`}
                        </p>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                          {question.answer}
                        </p>
                      </div>
                    )}
                  </div>

                  {!isAnswered && (
                    <div className="flex w-full flex-col gap-2 sm:w-auto">
                      <textarea
                        value={answers[question.questionId] || ''}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [question.questionId]: e.target.value,
                          }))
                        }
                        maxLength={2000}
                        rows={3}
                        placeholder="Write an answer…"
                        className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white sm:w-96"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => draftWithAI(question)}
                          disabled={busyId === question.questionId}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-40"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {busyId === question.questionId ? 'Drafting…' : 'Draft with AI'}
                        </button>
                        <button
                          onClick={() => saveAnswer(question)}
                          disabled={busyId === question.questionId}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
                        >
                          <Send className="h-3.5 w-3.5" /> Save answer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}