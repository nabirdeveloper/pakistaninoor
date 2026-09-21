import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { auth } from '@/auth';
import {
  buildSalesHistory,
  computeMerchandisingIntelligence,
  type MerchandiseProduct,
} from '@/lib/ai/merchandising';

// GET /api/admin/ai-merchandising — AI merchandising & inventory intelligence
//  - Reorder suggestions (demand velocity vs days of cover)
//  - Slow movers / dead stock
//  - Promo ideas (which SKUs deserve a discount, how deep, why)
// Deterministic local engine; runs entirely on DB data.
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const lookbackDays = 90;
    const cutoff = new Date(Date.now() - lookbackDays * 24 * 3600 * 1000);

    // Order statuses that represent real demand (exclude cancelled/returned/refunded).
    const countedStatuses = [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'out_for_delivery',
      'delivered',
    ];

    const [rawProducts, orderItemsChunk] = await Promise.all([
      Product.find({ status: 'active' })
        .select(
          'name slug price costPrice compareAtPrice stock lowStockThreshold averageRating category'
        )
        .populate('category', 'name')
        .lean(),
      Order.aggregate([
        { $match: { createdAt: { $gte: cutoff }, status: { $in: countedStatuses } } },
        { $unwind: '$items' },
        {
          $project: {
            product: '$items.product',
            quantity: '$items.quantity',
            createdAt: 1,
          },
        },
      ]),
    ]);

    const products: MerchandiseProduct[] = (rawProducts as any[]).map((p) => ({
      id: p._id.toString(),
      name: p.name,
      slug: p.slug,
      category:
        typeof p.category === 'object' && p.category && p.category.name
          ? p.category.name
          : undefined,
      price: p.price || 0,
      compareAtPrice: p.compareAtPrice,
      costPrice: p.costPrice,
      stock: p.stock || 0,
      lowStockThreshold: p.lowStockThreshold,
      averageRating: p.averageRating,
    }));

    const orderItems = (orderItemsChunk as any[]).map((o) => ({
      product: o.product ? o.product.toString() : '',
      quantity: o.quantity || 0,
      createdAt: o.createdAt,
    }));

    const history = buildSalesHistory(orderItems, new Date());
    const intelligence = computeMerchandisingIntelligence(products, history);

    return NextResponse.json({
      ...intelligence,
      source: 'deterministic',
      lookbackDays,
    });
  } catch (error: any) {
    console.error('AI merchandising error:', error);
    return NextResponse.json(
      { error: 'Failed to generate merchandising intelligence' },
      { status: 500 }
    );
  }
}