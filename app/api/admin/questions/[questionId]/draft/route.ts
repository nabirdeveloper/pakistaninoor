import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import { auth } from '@/auth';
import { ai, localAnswerProductQuestion, type CatalogProductInput } from '@/lib/ai/client';

/**
 * POST /api/admin/questions/[questionId]/draft
 *
 * Admin "Draft with AI": generates a suggested answer for a customer question
 * without persisting it. Admin reviews/edits the draft in the textarea before
 * pressing Save. Fallback chain: AI microservice → deterministic local engine.
 *
 * Returns { draft, answerable, source: 'ai' | 'local' }.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { questionId } = await params;
    if (!questionId.match(/^[a-f\d]{24}$/i)) {
      return NextResponse.json({ error: 'Invalid question id' }, { status: 400 });
    }

    const product = await Product.findOne({ 'questions._id': questionId });
    if (!product) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const question = product.questions.find((q) => String(q._id) === questionId);
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    let categoryName: string | undefined;
    try {
      const category = await Category.findById(product.category).select('name').lean();
      categoryName = (category as { name?: string } | null)?.name || undefined;
    } catch {
      // best-effort context enrichment
    }

    const catalogProduct: CatalogProductInput = {
      id: String(product._id),
      name: product.name,
      slug: product.slug,
      category: categoryName,
      tags: product.tags || [],
      description: product.description,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      stock: product.stock,
      salesCount: product.salesCount,
      averageRating: product.averageRating,
    };

    let result:
      | { answer: string; answerable: boolean; confidence: string; engine: string; generated_at: string }
      | null = null;
    try {
      result =
        (await ai.answerProductQuestion({ question: question.question, product: catalogProduct })) ??
        localAnswerProductQuestion({ question: question.question, product: catalogProduct });
    } catch (aiError) {
      console.error('Question draft generation failed:', aiError);
    }

    if (!result) {
      return NextResponse.json({ error: 'Could not generate a draft right now' }, { status: 502 });
    }

    return NextResponse.json(
      {
        draft: result.answer || '',
        answerable: result.answerable,
        source: result.engine === 'llm' ? 'ai' : 'local',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error drafting product question answer:', error);
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }
}