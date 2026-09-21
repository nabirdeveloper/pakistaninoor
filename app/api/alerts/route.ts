import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectDB } from '@/lib/db/mongodb';
import ProductAlert from '@/models/ProductAlert';
import Product from '@/models/Product';
import { auth } from '@/auth';
import { z } from 'zod';

/**
 * Product alert subscriptions (Phase 4).
 *
 * GET    /api/alerts?productId=  → { backInStock, priceDrop } for the signed-in user
 * POST   /api/alerts             { productId, type, targetPrice? } — subscribe
 * DELETE /api/alerts             { productId, type } — unsubscribe
 *
 * Alerts fire as in-app notifications when the product is restocked or drops in
 * price (see lib/notifications/checkProductAlerts.ts).
 */

const ALERT_TYPES = ['back_in_stock', 'price_drop'] as const;
type AlertType = (typeof ALERT_TYPES)[number];

const subscribeSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(ALERT_TYPES),
  targetPrice: z.number().min(0).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    await connectDB();

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const alerts = await ProductAlert.find({ user: userId, product: productId, isActive: true })
      .select('type')
      .lean();

    const subscribed = new Set(alerts.map((a) => a.type));
    return NextResponse.json(
      {
        backInStock: subscribed.has('back_in_stock'),
        priceDrop: subscribed.has('price_drop'),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching product alerts:', error);
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    await connectDB();

    const body = await request.json().catch(() => null);
    const parsed = subscribeSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Provide productId and type (back_in_stock or price_drop).' },
        { status: 400 }
      );
    }
    const { productId, type, targetPrice } = parsed.data;

    const product = await Product.findById(productId).select('_id').lean();
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await ProductAlert.findOneAndUpdate(
      { user: userId, product: productId, type },
      {
        $set: {
          user: new Types.ObjectId(userId),
          product: new Types.ObjectId(productId),
          type,
          targetPrice,
          isActive: true,
          notifiedAt: null,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ message: 'Alert subscribed', type }, { status: 200 });
  } catch (error) {
    console.error('Error subscribing to product alert:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    await connectDB();

    const body = await request.json().catch(() => null);
    const parsed = z
      .object({ productId: z.string().min(1), type: z.enum(ALERT_TYPES) })
      .safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Provide productId and type (back_in_stock or price_drop).' },
        { status: 400 }
      );
    }
    const { productId, type } = parsed.data;

    await ProductAlert.findOneAndUpdate(
      { user: userId, product: productId, type },
      { $set: { isActive: false } }
    );

    return NextResponse.json({ message: 'Alert removed', type }, { status: 200 });
  } catch (error) {
    console.error('Error removing product alert:', error);
    return NextResponse.json({ error: 'Failed to remove alert' }, { status: 500 });
  }
}