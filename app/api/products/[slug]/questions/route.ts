import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import { auth } from '@/auth';
import { ai, localAnswerProductQuestion, type CatalogProductInput } from '@/lib/ai/client';
import { z } from 'zod';

/**
 * POST /api/products/[slug]/questions
 *
 * Ask a question about a product (signed-in customers only). The question is
 * pushed to the product's Q&A list and the AI auto-answer engine attempts an
 * instant reply:
 *  - factual topics (price, stock, delivery, returns, payment, warranty) are
 *    answered immediately (service → deterministic local fallback),
 *  - product-specific questions are left unanswered and land in the admin
 *    Product Q&A queue for a human (or the "Draft with AI" tool) to answer.
 *
 * Auto-answered questions set `answer` + `answeredAt` but leave `answeredBy`
 * unset, so the storefront can show "AI assistant" and admins can distinguish
 * machine replies from human replies.
 */

const questionSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    await connectDB();

    const { slug } = await params;
    const body = await request.json().catch(() => null);
    const parsed = questionSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please enter a question between 3 and 500 characters.' },
        { status: 400 }
      );
    }
    const questionText = parsed.data.question;

    const product = await Product.findOne({ slug });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Category name is useful context for the AI answer engine.
    let categoryName: string | undefined;
    try {
      const category = await Category.findById(product.category).select('name').lean();
      categoryName = (category as { name?: string } | null)?.name || undefined;
    } catch {
      // best-effort; AI answers still work without a category name
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
      image: (product.images?.find((img: { isPrimary?: boolean }) => img.isPrimary) as { url?: string } | undefined)?.url,
    };

    const newQuestion = {
      user: new Types.ObjectId(userId),
      question: questionText,
      isPublic: true,
      createdAt: new Date(),
    };

    product.questions.push(newQuestion);

    // AI auto-answer (best-effort; a question is never blocked on the AI service)
    let isAutoAnswered = false;
    try {
      const verdict =
        (await ai.answerProductQuestion({ question: questionText, product: catalogProduct })) ??
        localAnswerProductQuestion({ question: questionText, product: catalogProduct });
      if (verdict?.answerable && verdict.answer?.trim()) {
        const pushed = product.questions[product.questions.length - 1];
        pushed.answer = verdict.answer.trim();
        pushed.answeredAt = new Date();
        // answeredBy intentionally left unset → UI shows "AI assistant"
        isAutoAnswered = true;
      }
    } catch (aiError) {
      console.error('Product question auto-answer skipped:', aiError);
    }

    await product.save();

    const saved = product.questions[product.questions.length - 1];

    return NextResponse.json(
      {
        message: isAutoAnswered
          ? 'Question submitted and answered by our AI assistant.'
          : 'Question submitted. Our team will answer it shortly.',
        question: {
          _id: saved._id,
          question: saved.question,
          answer: saved.answer,
          answeredAt: saved.answeredAt ? String(saved.answeredAt) : undefined,
          createdAt: String(saved.createdAt),
        },
        isAutoAnswered,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product question:', error);
    return NextResponse.json(
      { error: (error as Error)?.message || 'Failed to submit question' },
      { status: 500 }
    );
  }
}