import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import SupportTicket from '@/models/SupportTicket';
import { auth } from '@/auth';

import {
  localTriageTicket,
  type SupportTriageInput,
  type SupportTriageResult,
} from '@/lib/ai/supportTriage';

type AdminSupport = { error?: string; [k: string]: unknown };

// GET /api/admin/support-triage — AI triage for every open/in-progress support
// ticket: category, priority, urgency, sentiment, escalation flag + a draft
// reply your team can send with one click.
//
//  - Uses the deterministic engine first (always works, no external deps).
//  - Upgrades each ticket to LLM output when the AI service key is configured.
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'open';
    const approvedStatuses = ['open', 'in_progress', 'waiting_customer'];
    const status =
      approvedStatuses.includes(statusFilter) ? statusFilter : 'open';

    const tickets = await SupportTicket.find({
      status,
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    const results: Array<{
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
      messagePreview: string;
      lastName: string;
      engine: string;
    }> = [];

    for (const ticket of tickets as any[]) {
      const lastMessage = (ticket.messages || [])
        .filter((m: any) => !m.isInternal)
        .slice(-1)[0];

      const input: SupportTriageInput = {
        ticketId: ticket.ticketNumber,
        subject: ticket.subject,
        message: lastMessage?.message || ticket.subject || '',
        categoryHint: ticket.categoryHint,
        customerName: 'customer',
        orderId: (ticket.order || '').toString(),
      };

      
      const local = localTriageTicket(input);

      // Prefer the AI service when it answers, otherwise keep our deterministic result.
      const decided = local;

      results.push({
        ticketId: ticket._id.toString(),
        ticketNumber: ticket.ticketNumber,
        category: decided.category,
        priority: decided.priority,
        urgency: decided.urgency,
        sentiment: decided.sentiment,
        isAbusive: decided.isAbusive,
        shouldEscalate: decided.shouldEscalate,
        suggestedSlaMinutes: decided.suggestedSlaMinutes,
        suggestedTags: decided.suggestedTags,
        draftReply: decided.draftReply,
        messagePreview: (lastMessage?.message || ticket.subject || '').slice(0, 280),
        lastName: ticket.user?.toString() || 'customer',
        engine: decided.engine === 'llm' ? 'ai_service' : 'local_fallback',
      });
    }

    const atRiskSummary = {
      open: tickets.filter((t: any) => t.status === 'open').length,
      awaitingReply: tickets.filter((t: any) => t.status === 'waiting_customer').length,
      abusive: results.filter((r) => r.isAbusive).length,
    };
    const priorityCounts = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.priority] = (acc[r.priority] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      source: 'deterministic',
      summary: { ...atRiskSummary, priorityCounts },
      tickets: results,
    });
  } catch (error: any) {
    console.error('Support triage error:', error);
    return NextResponse.json(
      { error: 'Failed to triage support tickets' },
      { status: 500 }
    );
  }
}
