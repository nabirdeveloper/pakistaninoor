import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/db/mongodb';
import { buildTasteProfile, getTasteProfile, mergeViewSignal } from '@/lib/ai/personalization';
import { Types } from 'mongoose';

/**
 * GET  /api/user/ai-profile — the caller's AI taste profile (lazy rebuild).
 * POST /api/user/ai-profile — force-rebuild the profile from live signals, or
 *                             register a lightweight {productId, signal} event.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const profile = await getTasteProfile(session.user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error fetching AI profile:', error);
    return NextResponse.json({ error: 'Failed to load AI profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const body = await request.json().catch(() => ({}));

    // Lightweight signal event — used by the product page + checkout to teach
    // the profile without paying for a full rebuild every time.
    const productId = body?.productId;
    if (productId) {
      const signal = ['purchase', 'cart', 'wishlist', 'view'].includes(body?.signal)
        ? (body.signal as 'purchase' | 'cart' | 'wishlist' | 'view')
        : 'view';
      if (Types.ObjectId.isValid(productId)) {
        await mergeViewSignal(session.user.id, productId, signal);
        return NextResponse.json({ ok: true, mode: 'signal' });
      }
    }

    const profile = await buildTasteProfile(session.user.id);
    return NextResponse.json({ ok: true, mode: 'rebuild', profile });
  } catch (error) {
    console.error('Error updating AI profile:', error);
    return NextResponse.json({ error: 'Failed to update AI profile' }, { status: 500 });
  }
}