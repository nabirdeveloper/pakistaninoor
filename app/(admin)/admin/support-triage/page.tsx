'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Ban,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Tag,
  Ticket as TicketIcon,
  User,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SupportTriageTicket {
  ticketId: string;
  ticketNumber: string;
  category: string;
  priority: string;
  urgency: string;
  sentiment: string;
  isAbusive: boolean;
  shouldEscalate: boolean;
  suggestedSlaMinutes: number;
  suggestedTags: string[];
  draftReply: string;
  summary: string;
  messagePreview: string;
  lastName: string;
  engine: string;
  generated_at: string;
}

interface SupportTriageBody {
  generatedAt?: string;
  source?: string;
  summary?: {
    open?: number;
    awaitingReply?: number;
    abusive?: number;
    highPriority?: number;
    total?: number;
  };
  tickets?: SupportTriageTicket[];
}

function priorityChip(priority: string) {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    case 'high':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
    case 'medium':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'low':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminSupportTriagePage() {
  const [data, setData] = useState<SupportTriageBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/support-triage', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData(await res.json());
    } catch (e: any) {
      setError(e?.message || 'Failed to load support triage');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tickets = data?.tickets ?? [];
  const summary = data?.summary;
  const stats = [
    {
      key: 'total',
      label: 'Open tickets',
      value: summary?.open,
      icon: TicketIcon,
      color: 'text-blue-600',
    },
    {
      key: 'awaitingReply',
      label: 'Awaiting reply',
      value: summary?.awaitingReply,
      icon: MessageSquare,
      color: 'text-amber-500',
    },
    {
      key: 'abusive',
      label: 'Abusive',
      value: summary?.abusive,
      icon: Ban,
      color: 'text-red-500',
    },
    {
      key: 'escalate',
      label: 'Escalations',
      value: summary?.highPriority,
      icon: ShieldAlert,
      color: 'text-violet-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Support Triage
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Deterministic-first support ticket triage — category, priority,
            urgency, sentiment, abuse + escalation, SLA, tags, and a draft reply
            for every open ticket.
          </p>
        </div>
      </div>

      {/* Engine note */}
      {data?.source && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>
            Engine: <span className="font-medium text-gray-700 dark:text-gray-300">{data.source}</span>
          </span>
          <span className="ml-auto text-gray-400 dark:text-gray-500">
            Deterministic engine always runs — LLM upgrade hook ready in the AI service.
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</span>
              <stat.icon className={cn('h-4 w-4', stat.color)} />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {stat.value ?? '—'}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-700 dark:bg-gray-800">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Triaging support tickets…</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Failed to load support triage
          </div>
          <p className="mt-1 text-xs opacity-80">{error}</p>
          <button
            onClick={load}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          No open tickets to triage right now.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Urgency</th>
                  <th className="px-4 py-3 font-medium">Sentiment</th>
                  <th className="px-4 py-3 font-medium">SLA</th>
                  <th className="px-4 py-3 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {tickets.map((t) => (
                  <tr key={t.ticketId} className="align-top hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {t.ticketNumber || t.ticketId}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{t.lastName}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t.category}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', priorityChip(t.priority))}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t.urgency}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t.sentiment}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                        <Clock className="h-3.5 w-3.5" />
                        {t.suggestedSlaMinutes}m
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {t.isAbusive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            <Ban className="h-3 w-3" /> Abusive
                          </span>
                        ) : null}
                        {t.shouldEscalate ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                            <ShieldAlert className="h-3 w-3" /> Escalate
                          </span>
                        ) : null}
                        {t.suggestedTags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            <Tag className="h-3 w-3" /> {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Draft reply + preview affordance */}
          <div className="border-t border-gray-100 p-4 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
            Draft reply + summary available per ticket via the{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">tickets[].draftReply</code>{' '}
            and{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">tickets[].summary</code>{' '}
            fields.
          </div>
        </div>
      )}
    </div>
  );
}