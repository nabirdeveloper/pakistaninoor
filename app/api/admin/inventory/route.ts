import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Product from '@/models/Product';

/**
 * GET /api/admin/inventory
 *  - view: all | low | out | stocked
 *  - search: name/sku/barcode
 *  - page, limit
 * Returns summary stats + matching products sorted by lowest stock first.
 *
 * POST /api/admin/inventory
 *  - { slug, quantity }  → set absolute stock (>= 0)
 *  - { slug, delta }      → increment/decrement stock (cannot go below 0)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view') || 'all';
    const search = searchParams.get('search') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '20') || 20)
    );

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ];
    }
    if (view === 'low') {
      query.$expr = {
        $and: [
          { $gt: ['$stock', 0] },
          { $lte: ['$stock', '$lowStockThreshold'] },
        ],
      };
    } else if (view === 'out') {
      query.stock = { $lte: 0 };
    } else if (view === 'stocked') {
      query.stock = { $gt: 0 };
    }

    const [total, products, stats] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .select(
          'name slug sku barcode price costPrice stock lowStockThreshold trackInventory allowBackorder status images salesCount category'
        )
        .sort({ stock: 1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.aggregate<{
        _id: null;
        total: number;
        tracked: number;
        inStock: number;
        outOfStock: number;
        lowStock: number;
        stockValue: number;
      }>([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            tracked: { $sum: { $cond: ['$trackInventory', 1, 0] } },
            inStock: { $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] } },
            outOfStock: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
            lowStock: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$stock', 0] },
                      { $lte: ['$stock', '$lowStockThreshold'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            // Stock at cost price (rough inventory value)
            stockValue: { $sum: { $multiply: ['$stock', '$costPrice'] } },
          },
        },
      ]),
    ]);

    const s = stats[0] || {
      total: 0,
      tracked: 0,
      inStock: 0,
      outOfStock: 0,
      lowStock: 0,
      stockValue: 0,
    };

    return NextResponse.json({
      stats: s,
      products,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Inventory fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const body = await request.json();
    const { slug, quantity, delta } = body;

    if (!slug) {
      return NextResponse.json(
        { error: 'Product slug is required' },
        { status: 400 }
      );
    }

    const product = await Product.findOne({ slug });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let newQuantity = product.stock;
    if (typeof delta === 'number' && !isNaN(delta)) {
      newQuantity = Math.max(0, Math.round(product.stock + delta));
    } else if (typeof quantity === 'number' && !isNaN(quantity)) {
      newQuantity = Math.max(0, Math.round(quantity));
    } else {
      return NextResponse.json(
        { error: 'Provide either a target `quantity` or a `delta` adjustment' },
        { status: 400 }
      );
    }

    await Product.updateOne(
      { _id: product._id },
      { $set: { stock: newQuantity } }
    );

    const updated = await Product.findById(product._id)
      .select('name slug sku stock lowStockThreshold trackInventory')
      .lean();

    return NextResponse.json({ product: updated });
  } catch (error: any) {
    console.error('Inventory update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update stock' },
      { status: 500 }
    );
  }
}