import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import Order from '@/models/Order';
import { auth } from '@/auth';
import { ai, localModeration } from '@/lib/ai/client';
import { z } from 'zod';

/**
 * POST /api/reviews
 *
 * Submit a product review. The comment is screened by the AI moderation engine
 * (service → deterministic local fallback):
 *  - clean reviews are approved immediately and factor into the rating,
 *  - borderline/flagged reviews go to "pending" for the admin review queue,
 *    complete with the AI verdict (sentiment, toxicity, flags).
 */

const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  comment: z.string().min(3).max(2000),
  images: z.array(z.string()).max(6).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    await connectDB();

    const body = await request.json().catch(() => null);
    const parsed = reviewSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid review. Provide productId, a 1-5 rating and a comment (3-2000 chars).' },
        { status: 400 }
      );
    }
    const { productId, rating, title, comment, images } = parsed.data;

    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // One review per customer per product
    const alreadyReviewed = product.reviews.some(
      (r: { user: { toString: () => string } }) => String(r.user) === String(userId)
    );
    if (alreadyReviewed) {
      return NextResponse.json(
        { error: 'You have already reviewed this product' },
        { status: 409 }
      );
    }

    // Verified badge: this customer has a delivered/completed order with the product
    const verifiedCount = await Order.countDocuments({
      'items.product': productId,
      status: { $in: ['delivered', 'completed'] },
      $or: [{ user: userId }, { guestEmail: session.user.email }],
    });
    const isVerifiedPurchase = verifiedCount > 0;

    // AI moderation (best-effort; review submission never depends on it)
    let moderation: {
      sentiment: 'positive' | 'neutral' | 'negative';
      toxicity_score: number;
      flags: string[];
      recommendedAction: 'approve' | 'review' | 'flag';
      analyzedAt: Date;
    } = {
      sentiment: 'neutral',
      toxicity_score: 0,
      flags: [],
      recommendedAction: 'approve',
      analyzedAt: new Date(),
    };
    try {
      const verdict =
        (await ai.moderateReview({ text: comment, rating, productName: product.name })) ??
        localModeration({ text: comment, rating, productName: product.name });
      moderation = {
        sentiment: verdict.sentiment,
        toxicity_score: verdict.toxicity_score,
        flags: verdict.flags,
        recommendedAction: verdict.recommended_action,
        analyzedAt: new Date(verdict.analyzed_at),
      };
    } catch (modError) {
      console.error('Review moderation skipped (review still saved):', modError);
    }

    const isApproved = moderation.recommendedAction === 'approve';

    product.reviews.push({
      user: new Types.ObjectId(userId),
      rating,
      title: title?.trim() || undefined,
      comment: comment.trim(),
      images: images || [],
      helpfulCount: 0,
      isVerifiedPurchase,
      isApproved,
      moderation,
      createdAt: new Date(),
    });
    await product.save();

    return NextResponse.json(
      {
        message: isApproved
          ? 'Review submitted and published'
          : 'Review submitted for moderation (AI flagged it for review)',
        review: {
          isApproved,
          moderation,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: (error as Error)?.message || 'Failed to create review' },
      { status: 500 }
    );
  }
}