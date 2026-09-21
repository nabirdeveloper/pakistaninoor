import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import { auth } from '@/auth';
import { z } from 'zod';

/**
 * PATCH /api/admin/questions/[questionId]
 *
 * Admin answers a customer question. The product that owns the question is
 * resolved server-side (positional `$` update), so the client only needs the
 * questionId. `answeredBy` is always set here — AI auto-answers set answer +
 * answeredAt without answeredBy, so this distinguishes human replies.
 */

const answerSchema = z.object({
  answer: z.string().trim().min(1).max(2000),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const adminId = session.user.id as string;

    await connectDB();

    const { questionId } = await params;
    if (!questionId.match(/^[a-f\d]{24}$/i)) {
      return NextResponse.json({ error: 'Invalid question id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const parsed = answerSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please provide an answer (1-2000 characters).' },
        { status: 400 }
      );
    }

    const updated = await Product.findOneAndUpdate(
      { 'questions._id': questionId },
      {
        $set: {
          'questions.$.answer': parsed.data.answer,
          'questions.$.answeredBy': adminId,
          'questions.$.answeredAt': new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json(
      { message: 'Answer published', questionId, answeredAt: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error answering product question:', error);
    return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 });
  }
}