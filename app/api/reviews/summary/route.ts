import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import { ai, localReviewSummary } from '@/lib/ai/client';
import { z } from 'zod';

/**
 * POST /api/reviews/summary
 *
 * AI review-intelligence for a product page:
 *  - Sends the product's customer reviews to the AI microservice (/api/review-summary).
 *  - Falls back to the deterministic extractive summarizer when the service is down.
 */

const summarySchema = z.object({
  productId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = summarySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request. Provide a productId.' }, { status: 400 });
    }

    await connectDB();
    const product = await Product.findById(parsed.data.productId)
      .select('name reviews')
      .lean();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const reviews = ((product.reviews || []) as Array<{ comment: string; rating?: number }>).filter(
      (r) => (r.comment || '').trim().length > 0
    );

    if (reviews.length === 0) {
      return NextResponse.json(
        {
          summary: `No customer reviews yet for ${product.name}.`,
          summary_source: 'extractive',
          key_points: [],
          sentiment_mix: {},
          generated_at: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    const ratingBreakdown: Record<string, number> = {};
    for (const review of reviews) {
      const rating = review.rating ?? 0;
      ratingBreakdown[String(rating)] = (ratingBreakdown[String(rating)] || 0) + 1;
    }

    let result;
    try {
      result =
        (await ai.summarizeReviews({
          productName: product.name,
          reviews,
          ratingBreakdown,
        })) ??
        localReviewSummary({ productName: product.name, reviews, ratingBreakdown });
    } catch (summaryError) {
      console.error('Review summary service failed, using local extractive:', summaryError);
      result = localReviewSummary({ productName: product.name, reviews, ratingBreakdown });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in /api/reviews/summary:', error);
    return NextResponse.json({ error: 'Failed to summarize reviews' }, { status: 500 });
  }
}