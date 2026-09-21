import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Cart from '@/models/Cart';
import Order from '@/models/Order';
import { auth } from '@/auth';

/**
 * GET /api/admin/abandoned-carts?hours=24&limit=&offset=
 *
 * Lists user-attached carts with items that haven't been touched for `hours`.
 * Carts whose owner placed an order after the cart's last activity are excluded
 * (the cart converted to an order). Sorted by cart value (highest first) so the
 * admin recovers the most valuable carts first.
 */

interface AbandonedCartRecord {
  cartId: string;
  user: { _id: string; name: string; email: string } | null;
  items: Array<{ name: string; image?: string; slug: string; price: number; quantity: number }>;
  subtotal: number;
  total: number;
  itemCount: number;
  lastActivity: string;
  hoursSince: number;
  recoverySentAt?: string;
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
    const hours = Math.min(Math.max(Number(searchParams.get('hours')) || 24, 1), 24 * 30);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 200);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const carts = await Cart.find({
      user: { $exists: true },
      'items.0': { $exists: true },
      lastActivity: { $lt: cutoff },
    })
      .populate('user', 'name email')
      .select('user items subtotal total itemCount lastActivity recoverySentAt')
      .sort({ lastActivity: 1 })
      .limit(500)
      .lean();

    // Exclude carts already converted to an order after the cart's last activity
    const userIds = [
      ...new Set(
        carts
          .map((c) => (c.user as { _id?: unknown } | null)?._id)
          .filter((id): id is unknown => !!id)
          .map(String)
      ),
    ];
    const convertedUserIds = new Set<string>();
    if (userIds.length > 0) {
      const minLastActivity = carts.reduce(
        (min, c) => (c.lastActivity < min ? c.lastActivity : min),
        new Date()
      );
      const orders = await Order.find({
        user: { $in: userIds },
        createdAt: { $gte: minLastActivity },
      })
        .select('user createdAt')
        .lean();
      const orderTimeByUser = new Map<string, Date>();
      for (const order of orders) {
        const uid = String((order.user as { _id?: unknown } | undefined)?._id || order.user);
        const t = new Date(order.createdAt);
        const existing = orderTimeByUser.get(uid);
        if (!existing || t > existing) orderTimeByUser.set(uid, t);
      }
      for (const cart of carts) {
        const uid = String((cart.user as { _id?: unknown } | null)?._id || '');
        const orderTime = orderTimeByUser.get(uid);
        if (orderTime && orderTime >= cart.lastActivity) {
          convertedUserIds.add(String(cart._id));
        }
      }
    }

    const records: AbandonedCartRecord[] = [];
    for (const cart of carts) {
      if (convertedUserIds.has(String(cart._id))) continue;
      const user = cart.user as { _id?: unknown; name?: string; email?: string } | null;
      records.push({
        cartId: String(cart._id),
        user: user
          ? {
              _id: String(user._id || ''),
              name: user.name || '',
              email: user.email || '',
            }
          : null,
        items: (cart.items || []).map((item) => ({
          name: item.name,
          image: item.image,
          slug: item.slug,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal: cart.subtotal,
        total: cart.total,
        itemCount: cart.itemCount,
        lastActivity: String(cart.lastActivity),
        hoursSince: Math.max(0, Math.round((Date.now() - new Date(cart.lastActivity).getTime()) / 36e5)),
        recoverySentAt: cart.recoverySentAt ? String(cart.recoverySentAt) : undefined,
      });
    }

    records.sort((a, b) => b.total - a.total);

    const total = records.length;
    const pending = records.filter((r) => !r.recoverySentAt);
    const paginated = records.slice(offset, offset + limit);

    return NextResponse.json(
      {
        carts: paginated,
        counts: { total, pending, sent: total - pending.length },
        recoverableValue: pending.reduce((sum, r) => sum + r.total, 0),
        hours,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error listing abandoned carts:', error);
    return NextResponse.json({ error: 'Failed to load abandoned carts' }, { status: 500 });
  }
}