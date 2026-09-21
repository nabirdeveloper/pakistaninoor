import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import User from '@/models/User';
import Order from '@/models/Order';
import Cart from '@/models/Cart';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { ai, localRecommendations } from '@/lib/ai/client';

/**
 * GET /api/recommendations?mode=for-you&limit=8&productId=...&viewed=id1,id2
 *
 * AI-powered personalization root:
 *  - for-you          → AI recommendations from the caller's signals (logged-in
 *                       history + wishlist + orders + cart, or the `viewed` ids a
 *                       guest sends from localStorage). Falls back to local affinity.
 *  - frequently-bought→ order co-occurrence with `productId` (bought together).
 *  - related          → same-category + co-occurrence for `productId`.
 *  - cross-sell       → co-purchased with the caller's cart items (cart is read
 *                       server-side from the member doc or guest session cookie).
 *                       Falls back to the for-you engine with cart signals.
 *  - upsell           → higher-priced alternatives in the caller's cart categories.
 *                       Falls back to the for-you engine.
 *  - recently-viewed  → the logged-in user's recent history.
 *  - trending         → popularity fallback (best sellers, high rated, top sales).
 */

interface CatalogShape {
  id: string;
  name: string;
  slug?: string;
  category?: string;
  categoryId?: string;
  tags?: string[];
  description?: string;
  price?: number;
  salesCount?: number;
  averageRating?: number;
  image?: string;
}

const ACTIVE_FILTER = { status: 'active', visibility: { $in: ['visible', 'catalog', 'search'] } };

async function loadCatalog(): Promise<CatalogShape[]> {
  const products = await Product.find(ACTIVE_FILTER)
    .populate('category', 'name slug')
    .select('name slug category tags description price salesCount averageRating images')
    .limit(500)
    .lean();

  return products.map((p: { _id: unknown; name: string; slug: string; category?: { name?: string; _id?: unknown } | null; tags?: string[]; description: string; price: number; salesCount?: number; averageRating?: number; images?: Array<{ url: string }> }) => ({
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    category: p.category?.name,
    categoryId: String(p.category?._id || ''),
    tags: p.tags || [],
    description: p.description,
    price: p.price,
    salesCount: p.salesCount || 0,
    averageRating: p.averageRating || 0,
    image: p.images?.[0]?.url,
  }));
}

async function loadProductCards(ids: string[], limit: number) {
  const products = await Product.find({ _id: { $in: ids } })
    .populate('category', 'name slug')
    .select('name slug price compareAtPrice images averageRating totalReviews badges isNewArrival isBestSeller isOnSale')
    .lean();

  // Preserve caller order (recently viewed, co-occurrence rank, etc.)
  const order = new Map(ids.map((id, i) => [id, i]));
  products.sort((a: { _id: unknown }, b: { _id: unknown }) => (order.get(String(a._id)) ?? 1e9) - (order.get(String(b._id)) ?? 1e9));
  return products.slice(0, limit);
}

/**
 * Product ids currently in the caller's cart — a member's cart doc, or the guest
 * cart bound to the `cart_session` cookie (mirrors /api/cart).
 */
async function loadCallerCart(userId?: string): Promise<string[]> {
  const cookieStore = await cookies();
  const sessionId = userId ? undefined : cookieStore.get('cart_session')?.value;
  const query = userId ? { user: userId } : sessionId ? { sessionId } : null;
  if (!query) return [];
  const cart = await Cart.findOne(query).select('items.product').lean();
  return ((cart?.items as Array<{ product: unknown }> | undefined) || []).map((item) =>
    String(item.product)
  );
}

/** Co-purchase counts across completed orders for a set of cart product ids. */
async function coPurchaseCounts(cartIds: string[]): Promise<Map<string, number>> {
  const orders = await Order.find({
    status: {
      $in: ['delivered', 'shipped', 'out_for_delivery', 'processing', 'confirmed', 'pending'],
    },
    'items.product': { $in: cartIds },
  })
    .select('items.product')
    .lean();

  const co = new Map<string, number>();
  for (const order of orders) {
    const seen = new Set<string>();
    for (const item of order.items) {
      const id = String(item.product);
      if (cartIds.includes(id) || seen.has(id)) continue;
      seen.add(id);
      co.set(id, (co.get(id) || 0) + 1);
    }
  }
  return co;
}

/** Higher-priced alternatives in the same categories as the caller's cart items. */
async function upsellCandidates(cartIds: string[], limit: number) {
  const cartProducts = await Product.find({ _id: { $in: cartIds } })
    .select('price category')
    .lean();

  const prices = (cartProducts as Array<{ price?: number }>)
    .map((p) => p.price || 0)
    .filter((p) => p > 0);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const categories = [
    ...new Set(
      (cartProducts as Array<{ category?: unknown }>)
        .map((p) => String(p.category || ''))
        .filter(Boolean)
    ),
  ];

  const query: Record<string, unknown> = { ...ACTIVE_FILTER, _id: { $nin: cartIds } };
  if (categories.length > 0) query.category = { $in: categories };
  if (avgPrice > 0) query.price = { $gte: avgPrice };

  return Product.find(query)
    .populate('category', 'name slug')
    .select(
      'name slug price compareAtPrice images averageRating totalReviews badges isNewArrival isBestSeller isOnSale salesCount'
    )
    .sort({ price: -1, salesCount: -1, averageRating: -1 })
    .limit(limit)
    .lean();
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'for-you';
    const limit = Math.min(parseInt(searchParams.get('limit') || '8'), 24);
    const productId = searchParams.get('productId') || '';
    const viewedParam = (searchParams.get('viewed') || '').split(',').filter(Boolean);

    const session = await auth();
    const userId = session?.user?.id;

    // Products currently in the caller's cart — this drives the cart cross-sell /
    // upsell shelves and strengthens the for-you personalization signal.
    const cartIds = await loadCallerCart(userId);

    // ---------- frequently-bought / related (order co-occurrence) ----------
    if ((mode === 'frequently-bought' || mode === 'related') && productId) {
      const target = await Product.findById(productId).select('category name').lean();
      if (!target) {
        return NextResponse.json({ products: [], mode, source: 'rule', title: '' });
      }
      const targetCategory = (target as { category?: unknown }).category;

      // Count co-occurrence across all completed orders
      const orders = await Order.find({
        status: { $in: ['delivered', 'shipped', 'out_for_delivery', 'processing', 'confirmed', 'pending'] },
        'items.product': productId,
      })
        .select('items.product')
        .lean();

      const co = new Map<string, number>();
      for (const order of orders) {
        const seen = new Set<string>();
        for (const item of order.items) {
          const id = String(item.product);
          if (id === productId || seen.has(id)) continue;
          seen.add(id);
          co.set(id, (co.get(id) || 0) + 1);
        }
      }

      let ranked = [...co.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

      if (ranked.length === 0 && mode === 'related' && targetCategory) {
        // Fall back to same-category products as "You may also like"
        const sameCategory = await Product.find({
          ...ACTIVE_FILTER,
          category: targetCategory,
          _id: { $ne: productId },
        })
          .select('_id')
          .sort({ salesCount: -1 })
          .limit(limit)
          .lean();
        ranked = sameCategory.map((p: { _id: unknown }) => String(p._id));
      }

      const products = await loadProductCards(ranked.slice(0, limit), limit);
      const title =
        mode === 'frequently-bought'
          ? 'Frequently Bought Together'
          : 'You May Also Like';
      return NextResponse.json({
        products,
        mode,
        source: 'rule',
        title,
        totalPairs: co.size,
      });
    }

    // ---------- recently-viewed (logged-in history) ----------
    if (mode === 'recently-viewed' && userId) {
      const user = await User.findById(userId)
        .select('recentlyViewed')
        .lean<{ recentlyViewed?: unknown[] } | null>();
      const ids = (user?.recentlyViewed || []).map((id) => String(id));
      const products = await loadProductCards(ids.slice(0, limit), limit);
      return NextResponse.json({
        products,
        mode,
        source: 'rule',
        title: 'Recently Viewed',
      });
    }

    // ---------- trending (pure popularity) ----------
    if (mode === 'trending') {
      const products = await Product.find(ACTIVE_FILTER)
        .populate('category', 'name slug')
        .select('name slug price compareAtPrice images averageRating totalReviews badges isNewArrival isBestSeller isOnSale')
        .sort({ salesCount: -1, viewCount: -1, averageRating: -1 })
        .limit(limit)
        .lean();
      return NextResponse.json({
        products,
        mode,
        source: 'rule',
        title: 'Trending Products',
      });
    }

    // ---------- cross-sell (co-purchased with the caller's cart) ----------
    if (mode === 'cross-sell' && cartIds.length > 0) {
      const co = await coPurchaseCounts(cartIds);
      const ranked = [...co.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
      if (ranked.length > 0) {
        const products = await loadProductCards(ranked.slice(0, limit), limit);
        return NextResponse.json({
          products,
          mode,
          source: 'rule',
          title: 'Complete Your Order',
          reasons: Object.fromEntries(
            ranked.slice(0, limit).map((id) => [id, 'Often bought with items in your cart'])
          ),
        });
      }
      // No co-purchase history yet → fall through to the for-you engine (cart signals).
    }

    // ---------- upsell (premium alternatives to the caller's cart) ----------
    if (mode === 'upsell' && cartIds.length > 0) {
      const upsold = (await upsellCandidates(cartIds, limit)) as Array<{ _id: unknown }>;
      if (upsold.length > 0) {
        return NextResponse.json({
          products: upsold,
          mode,
          source: 'rule',
          title: 'Premium Picks for You',
          reasons: Object.fromEntries(
            upsold.map((p) => [String(p._id), 'Higher-value option in a category you are shopping'])
          ),
        });
      }
      // No premium candidates → fall through to the for-you engine.
    }

    // ---------- for-you (default) ----------
    const catalog = await loadCatalog();

    let signalIds: string[] = [...viewedParam];
    let purchasedIds: string[] = [];

    if (userId) {
      const [user, orderDocs] = await Promise.all([
        User.findById(userId)
          .select('recentlyViewed wishlist')
          .lean<{ recentlyViewed?: unknown[]; wishlist?: unknown[] } | null>(),
        Order.find({ user: userId })
          .select('items.product')
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
      ]);
      signalIds = [
        ...(user?.recentlyViewed || []).map((id) => String(id)),
        ...(user?.wishlist || []).map((id) => String(id)),
        ...viewedParam,
      ];
      purchasedIds = orderDocs.flatMap((o) => o.items.map((i) => String(i.product)));
    }

    // De-dupe signals (cart items flow through `cartProducts` instead)
    signalIds = [...new Set(signalIds)].filter(
      (id) => catalog.some((p) => p.id === id) && !cartIds.includes(id)
    );

    const excludeIds = [...new Set([...signalIds, ...cartIds, ...purchasedIds])];

    const aiResult = await ai.recommendations({
      userId,
      viewedProducts: signalIds.slice(0, 30),
      purchasedProducts: purchasedIds.slice(0, 30),
      cartProducts: cartIds.slice(0, 20),
      catalog,
      excludeIds,
      limit,
    });

    let recommendations = aiResult?.recommendations || [];
    let source = aiResult ? 'ai' : 'local';

    if (recommendations.length === 0 || !aiResult) {
      // Local fallback — for pure guests this is popularity-driven
      const local = await localRecommendations({
        userId,
        viewedProducts: signalIds,
        purchasedProducts: purchasedIds,
        cartProducts: cartIds.slice(0, 20),
        catalog,
        excludeIds,
        limit,
      });
      recommendations = local.recommendations;
      source = 'local';
    }

    if (recommendations.length === 0) {
      // No signals at all → trending shelf so the section is never empty
      const trending = await Product.find(ACTIVE_FILTER)
        .populate('category', 'name slug')
        .select('name slug price compareAtPrice images averageRating totalReviews badges isNewArrival isBestSeller isOnSale')
        .sort({ salesCount: -1, viewCount: -1 })
        .limit(limit)
        .lean();
      return NextResponse.json({
        products: trending,
        mode,
        source: 'rule',
        title: 'Trending Products',
      });
    }

    const ids = recommendations.map((r) => r.productId);
    const products = await loadProductCards(ids, limit);

    return NextResponse.json({
      products,
      mode,
      source,
      title: signalIds.length + cartIds.length > 0 ? 'Recommended for You' : 'Trending Products',
      reasons: aiResult?.reasons || {},
    });
  } catch (error) {
    console.error('Error in recommendations:', error);
    return NextResponse.json({ products: [], mode: 'for-you', source: 'local', title: '' });
  }
}