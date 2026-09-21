import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Cart from '@/models/Cart';
import Notification from '@/models/Notification';
import { auth } from '@/auth';
import { z } from 'zod';

/**
 * POST /api/admin/abandoned-carts/[cartId]/send
 *
 * Sends the admin-approved recovery message for an abandoned cart:
 *  - creates an in-app Notification for the customer (type 'abandoned_cart'),
 *  - stamps `recoverySentAt` on the cart so it leaves the recovery queue.
 *
 * Body: { subject, message }.
 */

const sendSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(3000),
});

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

    const body = await request.json().catch(() => null);
    const parsed = sendSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Subject and message are required (subject ≤ 200, message ≤ 3000 chars).' },
        { status: 400 }
      );
    }

    const cart = await Cart.findById(cartId).populate('user', 'name email');
    if (!cart) {
      return NextResponse.json({ error: 'Cart not found' }, { status: 404 });
    }
    if (!cart.user) {
      return NextResponse.json(
        { error: 'This cart has no linked customer account to notify.' },
        { status: 400 }
      );
    }

    // Stamp the cart as recovered FIRST so a notification is never persisted
    // without `recoverySentAt` — if the cart save fails (bad item data, etc.)
    // the cart stays in the queue and the admin can retry without a duplicate
    // notification landing in the customer's inbox.
    cart.recoverySentAt = new Date();
    await cart.save();

    const notification = new Notification({
      user: cart.user,
      type: 'abandoned_cart',
      title: parsed.data.subject,
      message: parsed.data.message,
      link: '/cart',
      channels: ['app'],
      sentVia: { app: true, email: false, sms: false, push: false },
    });

    try {
      await notification.save();
    } catch (notifyError) {
      // Best-effort rollback: un-stamp the cart so the recovery is retryable.
      cart.recoverySentAt = undefined;
      await cart.save().catch(() => {});
      throw notifyError;
    }

    return NextResponse.json(
      {
        message: 'Recovery message sent',
        notificationId: String(notification._id),
        recoverySentAt: cart.recoverySentAt,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending recovery message:', error);
    return NextResponse.json({ error: 'Failed to send recovery message' }, { status: 500 });
  }
}