import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import { auth } from '@/auth';

/**
 * Admin Product Q&A queue.
 *
 * GET /api/admin/questions?status=pending|answered&limit=&offset=
 * Flattens every product's customer questions. Pending = unanswered
 * (answer missing/empty); answered = has an answer. Auto-answered questions
 * (by the AI) report `answeredBy: null`.
 */

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

function isAdmin(session: { user?: { role?: string } } | null): boolean {
  return !!session && (session.user?.role === 'admin' || session.user?.role === 'superadmin');
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const products = await Product.find({ 'questions.0': { $exists: true } })
      .populate('questions.user', 'name email')
      .populate('questions.answeredBy', 'name')
      .select('name slug questions')
      .sort({ updatedAt: -1 })
      .lean();

    const records: QuestionRecord[] = [];
    for (const product of products) {
      for (const q of product.questions || []) {
        const isAnswered = typeof q.answer === 'string' && q.answer.trim().length > 0;
        let matches = true;
        if (status === 'pending') matches = !isAnswered;
        else if (status === 'answered') matches = isAnswered;
        if (!matches) continue;

        records.push({
          questionId: String(q._id),
          product: {
            _id: String(product._id),
            name: product.name,
            slug: product.slug,
          },
          user: q.user
            ? {
                _id: String((q.user as { _id?: unknown })._id || ''),
                name: (q.user as { name?: string }).name || '',
                email: (q.user as { email?: string }).email,
              }
            : null,
          question: q.question,
          answer: q.answer,
          answeredBy: q.answeredBy
            ? {
                _id: String((q.answeredBy as { _id?: unknown })._id || ''),
                name: (q.answeredBy as { name?: string }).name || '',
              }
            : null,
          answeredAt: q.answeredAt ? String(q.answeredAt) : undefined,
          createdAt: String(q.createdAt),
        });
      }
    }

    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = records.length;
    const paginated = records.slice(offset, offset + limit);

    const counts = {
      pending: records.filter((r) => !r.answer || r.answer.trim() === '').length,
      answered: records.filter((r) => typeof r.answer === 'string' && r.answer.trim().length > 0).length,
      total,
    };

    return NextResponse.json({ questions: paginated, counts, total, limit, offset }, { status: 200 });
  } catch (error) {
    console.error('Error listing product questions:', error);
    return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
  }
}