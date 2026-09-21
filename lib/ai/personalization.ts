import mongoose from 'mongoose';
import User, { IUser, PriceTier } from '@/models/User';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Cart from '@/models/Cart';

/**
 * AI Personalization Hub (Phase 1)
 * ================================
 * Learns a persistent taste profile per customer from their real signals —
 * completed orders (3×), cart (2×), wishlist (2×) and product views (1×).
 *
 * The profile is stored on the User document (`aiProfile`) so personalization
 * survives across visits and never depends on transient request data.
 *
 * NOTE: callers must `await connectDB()` first (routes already do).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const SIGNAL_WEIGHTS = { purchase: 3, cart: 2, wishlist: 2, view: 1 } as const;
export type SignalKind = keyof typeof SIGNAL_WEIGHTS;

export interface PreferredCategory {
  id: string;
  name: string;
  score: number;
}

/**
 * Safe-to-serialize shape returned to the storefront (no Document internals).
 */
export interface TasteProfileView {
  categoryAffinity: Record<string, number>;
  tagAffinity: Record<string, number>;
  priceTier: PriceTier;
  engagementScore: number;
  preferredCategories: PreferredCategory[];
  preferredTags: string[];
  insight: string;
  isFresh: boolean;
  lastSignalsAt?: string;
}

interface SignalItem {
  productId: string;
  categoryId?: string;
  categoryName?: string;
  tags: string[];
  price: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priceTierFromAverage(avgPrice: number): PriceTier {
  if (avgPrice <= 0) return 'unknown';
  if (avgPrice < 600) return 'budget';
  if (avgPrice < 2500) return 'mid';
  return 'premium';
}

/** Engagement: more distinct products + more signal kinds ⇒ higher score (0..100). */
function engagementScore(
  signals: Array<{ id: string }>,
  kinds: { purchase: number; cart: number; wishlist: number; view: number }
): number {
  const distinct = new Set(signals.map((s) => s.id)).size;
  const kindCount = [kinds.purchase, kinds.cart, kinds.wishlist, kinds.view].filter((n) => n > 0).length;
  return Math.min(100, Math.round(distinct * 3 + kindCount * 8 + Math.min(kinds.purchase, 10) * 2));
}

/** Human-readable one-liner about the shopper's taste (used by the UI card). */
export function describeProfile(p: {
  priceTier: PriceTier;
  engagementScore: number;
  preferredCategories: PreferredCategory[];
  preferredTags: string[];
}): string {
  const top = p.preferredCategories[0];
  const tierLabel =
    p.priceTier === 'budget' ? 'value-conscious budget shopper'
    : p.priceTier === 'mid' ? 'mid-range shopper'
    : p.priceTier === 'premium' ? 'premium shopper'
    : 'shopper';
  const interest = top ? `Mostly into ${top.name.toLowerCase()}` : 'Exploring the catalog';
  const signals =
    p.engagementScore >= 60 ? 'We know your taste well' :
    p.engagementScore >= 25 ? 'We are learning your taste' :
    'Browse a bit more so we can personalize better';
  return `${interest} · ${tierLabel}. ${signals}.`;
}

// ---------------------------------------------------------------------------
// Profile builder
// ---------------------------------------------------------------------------

/**
 * Rebuild the user's taste profile from their actual signals and persist it.
 * Returns the serializable view.
 */
export async function buildTasteProfile(userId: string): Promise<TasteProfileView> {
  const user = await User.findById(userId).select('recentlyViewed wishlist aiProfile').lean<{
    recentlyViewed?: unknown[];
    wishlist?: unknown[];
  } | null>();

  if (!user) {
    throw new Error('User not found');
  }

  const viewedIds = (user.recentlyViewed || []).map((id) => String(id));
  const wishlistIds = (user.wishlist || []).map((id) => String(id));

  // Completed/pending orders → purchased product ids
  const orders = await Order.find({ user: new mongoose.Types.ObjectId(userId) })
    .select('items.product status')
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  const purchasedIds = orders.flatMap((o) => o.items.map((i) => String(i.product)));

  // Current cart (member cart doc only — no guest session here)
  const cart = await Cart.findOne({ user: new mongoose.Types.ObjectId(userId) })
    .select('items.product')
    .lean();
  const cartIds = ((cart?.items as Array<{ product: unknown }> | undefined) || []).map((i) => String(i.product));

  // Build a per-signal product list
  const signalItems: Array<{ id: string; kind: SignalKind }> = [
    ...viewedIds.slice(0, 24).map((id) => ({ id, kind: 'view' as SignalKind })),
    ...wishlistIds.slice(0, 24).map((id) => ({ id, kind: 'wishlist' as SignalKind })),
    ...cartIds.slice(0, 12).map((id) => ({ id, kind: 'cart' as SignalKind })),
    ...purchasedIds.slice(0, 24).map((id) => ({ id, kind: 'purchase' as SignalKind })),
  ];

  const kinds = { purchase: purchasedIds.length, cart: cartIds.length, wishlist: wishlistIds.length, view: viewedIds.length };

  if (signalItems.length === 0) {
    const empty: TasteProfileView = {
      categoryAffinity: {},
      tagAffinity: {},
      priceTier: 'unknown',
      engagementScore: 0,
      preferredCategories: [],
      preferredTags: [],
      insight: describeProfile({ priceTier: 'unknown', engagementScore: 0, preferredCategories: [], preferredTags: [] }),
      isFresh: true,
    };
    return empty;
  }

  // Load product details for every signal id in one query
  const uniqueIds = [...new Set(signalItems.map((s) => s.id))];
  const products = await Product.find({ _id: { $in: uniqueIds } })
    .populate('category', 'name slug')
    .select('name category tags price')
    .lean() as Array<{ _id: unknown; name: string; category?: { name?: string; _id?: unknown } | null; tags?: string[]; price?: number }>;

  const productById = new Map(products.map((p) => [String(p._id), p]));

  const categoryAffinity = new Map<string, number>();
  const tagAffinity = new Map<string, number>();
  let priceSum = 0;
  let priceCount = 0;
  const seenSignals = new Set<string>();

  for (const { id, kind } of signalItems) {
    const product = productById.get(id);
    if (!product) continue;
    const weight = SIGNAL_WEIGHTS[kind];
    const cat = product.category?.name;
    if (cat) {
      categoryAffinity.set(cat, (categoryAffinity.get(cat) || 0) + weight);
    }
    for (const tag of product.tags || []) {
      tagAffinity.set(tag, (tagAffinity.get(tag) || 0) + weight);
    }
    if (typeof product.price === 'number' && product.price > 0) {
      priceSum += product.price;
      priceCount += 1;
    }
    seenSignals.add(id);
  }

  // Derived preferences
  const preferredCategories: PreferredCategory[] = [...categoryAffinity.entries()]
    .map(([name, score]) => ({ name, id: name, score: Math.round(score * 100) / 100 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const preferredTags = [...tagAffinity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  const avgPrice = priceCount > 0 ? priceSum / priceCount : 0;
  const tier = priceTierFromAverage(avgPrice);
  const score = engagementScore(signalItems, kinds);

  const now = new Date();
  const profile = {
    categoryAffinity,
    tagAffinity,
    priceTier: tier,
    engagementScore: score,
    preferredCategories: preferredCategories.map((c) => c.name),
    preferredTags,
    viewedProductIds: [...new Set([...viewedIds, ...wishlistIds, ...cartIds])].slice(0, 40).map((id) => new mongoose.Types.ObjectId(id)),
    purchasedProductIds: purchasedIds.slice(0, 40).map((id) => new mongoose.Types.ObjectId(id)),
    lastSignalsAt: now,
    updatedAt: now,
  };

  await User.updateOne({ _id: new mongoose.Types.ObjectId(userId) }, { $set: { aiProfile: profile } });

  return {
    categoryAffinity: Object.fromEntries(categoryAffinity),
    tagAffinity: Object.fromEntries(tagAffinity),
    priceTier: tier,
    engagementScore: score,
    preferredCategories,
    preferredTags,
    insight: describeProfile({ priceTier: tier, engagementScore: score, preferredCategories, preferredTags }),
    isFresh: true,
    lastSignalsAt: now.toISOString(),
  };
}

/** Freshness threshold — rebuild once a day unless forced. */
export const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;

/** Maps can be returned as either Map instances or plain objects (lean). */
function normalizeAffinity(value: unknown): Record<string, number> {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  if (typeof value === 'object') return value as Record<string, number>;
  return {};
}

/**
 * Get the user's stored taste profile. Rebuilds lazily when missing or stale
 * (older than 24h) so account pages always show current data.
 */
export async function getTasteProfile(userId: string): Promise<TasteProfileView> {
  const user = await User.findById(userId).select('aiProfile').lean<{
    aiProfile?: {
      updatedAt?: Date;
      lastSignalsAt?: Date;
      engagementScore?: number;
      preferredCategories?: string[];
      preferredTags?: string[];
      priceTier?: PriceTier;
      categoryAffinity?: unknown;
      tagAffinity?: unknown;
    };
  } | null>();
  const stored = user?.aiProfile;

  const isFresh =
    !!stored &&
    !!stored.updatedAt &&
    Date.now() - new Date(stored.updatedAt).getTime() < PROFILE_TTL_MS &&
    typeof stored.engagementScore === 'number' &&
    Array.isArray(stored.preferredCategories) &&
    Array.isArray(stored.preferredTags);

  if (isFresh && stored) {
    const categoryAffinity = normalizeAffinity(stored.categoryAffinity);
    const preferredCategories: PreferredCategory[] = (stored.preferredCategories || []).map((name) => ({
      name,
      id: name,
      score: Math.round((categoryAffinity[name] || 0) * 100) / 100,
    }));
    return {
      categoryAffinity,
      tagAffinity: normalizeAffinity(stored.tagAffinity),
      priceTier: stored.priceTier || 'unknown',
      engagementScore: stored.engagementScore || 0,
      preferredCategories,
      preferredTags: stored.preferredTags || [],
      insight: describeProfile({
        priceTier: stored.priceTier || 'unknown',
        engagementScore: stored.engagementScore || 0,
        preferredCategories,
        preferredTags: stored.preferredTags || [],
      }),
      isFresh: true,
      lastSignalsAt: stored.lastSignalsAt?.toISOString(),
    };
  }

  // Stale or missing → rebuild from live signals.
  return buildTasteProfile(userId);
}

/**
 * Cheap incremental view/cart signal — bump affinity maps without a full
 * rebuild. Used on product view so browsing continuously teaches the profile.
 */
export async function mergeViewSignal(userId: string, productId: string, kind: SignalKind = 'view'): Promise<void> {
  const product = await Product.findById(productId)
    .populate('category', 'name')
    .select('category tags price')
    .lean() as { name: string; category?: { name?: string } | null; tags?: string[]; price?: number } | null;
  if (!product) return;

  const weight = SIGNAL_WEIGHTS[kind];
  const inc: Record<string, number> = { 'aiProfile.engagementScore': kind === 'purchase' ? 4 : 1 };
  if (product.category?.name) inc[`aiProfile.categoryAffinity.${product.category.name}`] = weight;
  for (const tag of (product.tags || []).slice(0, 5)) {
    inc[`aiProfile.tagAffinity.${tag}`] = weight;
  }

  await User.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    {
      $inc: inc,
      $set: { 'aiProfile.lastSignalsAt': new Date(), 'aiProfile.updatedAt': new Date() },
      $min: { 'aiProfile.engagementScore': 100 },
    }
  );
}