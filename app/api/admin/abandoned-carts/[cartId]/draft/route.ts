import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Cart from '@/models/Cart';
import { auth } from '@/auth';
import { ai, localDraftRecoveryMessage, type RecoveryItemInput } from '@/lib/ai/client';

/**
 * POST /api/admin/abandoned-carts/[cartId]/draft
 *
 * AI-drafts a personalized recovery message for an abandoned cart (service →
 * deterministic local fallback). Nothing is persisted — the admin reviews the
 * draft before sending. Requires a user-attached cart (guests can't be notified).
 *
 * Returns { result: { subject, message }, source: 'ai' | 'local' }.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ cartId: string }> }
) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();

    const { cartId } = await params;
    if (!cartId.match(/^[a-f\d]{24}$/i)) {
      return NextResponse.json({ error: 'Invalid cart id' }, { status: 400 });
    }

    const cart = await Cart.findById(cartId).populate('user', 'name email').lean();
    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }
    const user = cart.user as { name?: string; email?: string } | null;
    if (!cart.user || !user?.email) {
      return NextResponse.json(
        { error: 'This cart has no linked customer account to notify.' },
        { status: 400 }
      );
    }

    const items: RecoveryItemInput[] = (cart.items || []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));

    const hours = Math.max(
      1,
      Math.round((Date.now() - new Date(cart.lastActivity).getTime()) / 36e5)
    );

    let result: { subject: string; message: string; engine: string; generated_at: string } | null = null;
    try {
      result =
        (await ai.draftRecoveryMessage({
          customerName: user.name,
          items,
          cartValue: cart.total,
          hoursAbandoned: hours,
        })) ??
        localDraftRecoveryMessage({
          customerName: user.name,
          items,
          cartValue: cart.total,
          hoursAbandoned: hours,
        });
    } catch (aiError) {
      console.error('Recovery draft generation failed:', aiError);
    }

    if (!result) {
      return NextResponse.json({ error: 'Could not draft a message right now' }, { status: 502 });
    }

    return NextResponse.json(
      {
        result: { subject: result.subject, message: result.message },
        source: result.engine === 'llm' ? 'ai' : 'local',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error drafting recovery message:', error);
    return NextResponse.json({ error: 'Failed to draft message' }, { status: 500 });
  }
}