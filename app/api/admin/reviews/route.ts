import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import { auth } from '@/auth';
import { Types } from 'mongoose';
import { z } from 'zod';

/**
 * Admin review-intelligence queue.
 *
 * GET    /api/admin/reviews?status=pending|flagged|approved&limit=&offset=
 *        Flattens every product's customer reviews with AI moderation verdicts.
 * PATCH  /api/admin/reviews  { productId, reviewId, action: 'approve' | 'reject' | 'reply', reply? }
 * DELETE /api/admin/reviews  { productId, reviewId }
 */

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

    const products = await Product.find({ 'reviews.0': { $exists: true } })
      .populate('reviews.user', 'name email avatar')
      .populate('reviews.repliedBy', 'name')
      .select('name slug reviews')
      .sort({ updatedAt: -1 })
      .lean();

    const records: ReviewRecord[] = [];
    for (const product of products) {
      for (const review of product.reviews || []) {
        const moderation = review.moderation as ReviewRecord['moderation'] | undefined;
        const flagged =
          moderation?.recommendedAction === 'flag' ||
          (moderation?.toxicity_score ?? 0) >= 0.25;

        let matches = true;
        if (status === 'pending') matches = !review.isApproved;
        else if (status === 'flagged') matches = flagged || !review.isApproved;
        else if (status === 'approved') matches = !!review.isApproved;
        if (!matches) continue;

        records.push({
          reviewId: String(review._id),
          product: {
            _id: String(product._id),
            name: product.name,
            slug: product.slug,
          },
          user: review.user
            ? { _id: String((review.user as { _id?: unknown })._id || ''), name: (review.user as { name?: string }).name || '', email: (review.user as { email?: string }).email, avatar: (review.user as { avatar?: string }).avatar }
            : null,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          isApproved: !!review.isApproved,
          isVerifiedPurchase: !!review.isVerifiedPurchase,
          moderation: moderation
            ? {
                sentiment: moderation.sentiment,
                toxicity_score: moderation.toxicity_score,
                flags: moderation.flags || [],
                recommendedAction: moderation.recommendedAction,
                analyzedAt: moderation.analyzedAt ? String(moderation.analyzedAt) : undefined,
              }
            : undefined,
          reply: review.reply,
          repliedBy: review.repliedBy
            ? {
                _id: String((review.repliedBy as { _id?: unknown })._id || ''),
                name: (review.repliedBy as { name?: string }).name || '',
              }
            : null,
          repliedAt: review.repliedAt ? String(review.repliedAt) : undefined,
          createdAt: String(review.createdAt),
        });
      }
    }

    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = records.length;
    const paginated = records.slice(offset, offset + limit);

    const counts = {
      pending: records.filter((r) => !r.isApproved).length,
      flagged: records.filter(
        (r) => r.moderation?.recommendedAction === 'flag' || (r.moderation?.toxicity_score ?? 0) >= 0.25
      ).length,
      approved: records.filter((r) => r.isApproved).length,
      total,
    };

    return NextResponse.json({ reviews: paginated, counts, total, limit, offset }, { status: 200 });
  } catch (error) {
    console.error('Error listing reviews:', error);
    return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 });
  }
}

const patchSchema = z.object({
  productId: z.string().min(1),
  reviewId: z.string().min(1),
  action: z.enum(['approve', 'reject', 'reply']),
  reply: z.string().trim().min(1).max(2000).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request: productId, reviewId and action required.' },
        { status: 400 }
      );
    }
    const { productId, reviewId, action, reply } = parsed.data;

    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const review = product.reviews.find((r) => String(r._id) === reviewId);
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (action === 'reply') {
      if (!reply) {
        return NextResponse.json({ error: 'A reply (1-2000 characters) is required.' }, { status: 400 });
      }
      review.reply = reply;
      review.repliedBy = new Types.ObjectId(session!.user.id as string);
      review.repliedAt = new Date();
      await product.save();
      return NextResponse.json(
        { message: 'Reply published', reviewId, repliedAt: review.repliedAt },
        { status: 200 }
      );
    }

    const isApproved = action === 'approve';
    review.isApproved = isApproved;
    await product.save(); // pre-save hook recomputes averageRating/totalReviews

    return NextResponse.json(
      { message: isApproved ? 'Review approved' : 'Review rejected', reviewId, isApproved },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating review:', error);
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();

    const body = await request.json().catch(() => null);
    const parsed = z
      .object({ productId: z.string().min(1), reviewId: z.string().min(1) })
      .safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request: productId and reviewId required.' }, { status: 400 });
    }
    const { productId, reviewId } = parsed.data;

    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const review = product.reviews.find((r) => String(r._id) === reviewId);
    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    product.reviews = product.reviews.filter((r) => String(r._id) !== reviewId);
    await product.save(); // pre-save hook recomputes averageRating/totalReviews

    return NextResponse.json({ message: 'Review deleted', reviewId }, { status: 200 });
  } catch (error) {
    console.error('Error deleting review:', error);
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
  }
}