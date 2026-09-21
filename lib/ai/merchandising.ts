/**
 * AI Merchandising & Inventory Intelligence (Phase 2)
 * ===================================================
 * Turns raw catalog + order data into actionable decisions:
 *
 *   1. Reorder suggestions — demand velocity (units/day) × days-of-cover →
 *      how many units to order to reach a target cover.
 *   2. Slow-mover / dead-stock detection — inventory locked up with weak demand.
 *   3. Promo ideas — which SKUs deserve a discount, how deep, and why.
 *
 * Pure functions: the API route gathers the data, this module decides.
 */

export interface MerchandiseProduct {
  id: string;
  name: string;
  slug?: string;
  category?: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  stock: number;
  lowStockThreshold?: number;
  averageRating?: number;
}

/** Units sold per product over a window (recent-first daily series from orders). */
export interface SalesHistory {
  productId: string;
  /** Total units sold in the lookback window. */
  unitsSold: number;
  /** Window length in days the units were accumulated over (7/30/90). */
  windowDays: number;
  lastOrderAt?: string;
}

export interface ReorderSuggestion {
  productId: string;
  name: string;
  slug?: string;
  category?: string;
  currentStock: number;
  avgDailySales: number;
  daysOfCover: number;
  targetCoverDays: number;
  suggestedOrderQty: number;
  urgency: 'critical' | 'low' | 'ok' | 'stale';
}

export interface SlowMover {
  productId: string;
  name: string;
  slug?: string;
  category?: string;
  currentStock: number;
  unitsSold90d: number;
  daysOfCover: number;
  lockedValue: number;
  status: 'slow' | 'dead';
}

export interface PromoIdea {
  productId: string;
  name: string;
  slug?: string;
  category?: string;
  price: number;
  compareAtPrice?: number;
  currentStock: number;
  daysOfCover: number;
  estimatedMarginPct: number;
  suggestedDiscountPct: number;
  suggestedPrice: number;
  /** 'stock_pressure' | 'margin_clearance' | 'low_velocity' */
  reason: string;
}

export interface MerchandisingIntelligence {
  generatedAt: string;
  reorderSuggestions: ReorderSuggestion[];
  slowMovers: SlowMover[];
  promoIdeas: PromoIdea[];
  summary: {
    criticalRestockProducts: number;
    deadStockProducts: number;
    promoPotentialProducts: number;
    lockedInventoryValue: number;
  };
}

export const DEFAULT_TARGET_COVER_DAYS = 30;
export const PROMO_LOOKBACK_DAYS = 90;

function marginPct(product: MerchandiseProduct): number | null {
  if (typeof product.costPrice === 'number' && product.costPrice > 0 && product.price > 0) {
    return Math.max(0, ((product.price - product.costPrice) / product.price) * 100);
  }
  // No cost data — infer from compareAtPrice when present (assumes old price ≈ cost + margin).
  if (typeof product.compareAtPrice === 'number' && product.compareAtPrice > product.price) {
    return Math.max(0, ((product.compareAtPrice - product.price) / product.compareAtPrice) * 100);
  }
  return null;
}

function velocityOf(history: Map<string, SalesHistory>, productId: string): number {
  const h = history.get(productId);
  if (!h || h.unitsSold <= 0 || h.windowDays <= 0) return 0;
  return h.unitsSold / h.windowDays;
}

function daysOfCoverOf(stock: number, velocity: number): number {
  if (velocity <= 0) return stock > 0 ? Number.POSITIVE_INFINITY : 0;
  return stock / velocity;
}

export function computeMerchandisingIntelligence(
  products: MerchandiseProduct[],
  history: SalesHistory[],
  targetCoverDays: number = DEFAULT_TARGET_COVER_DAYS
): MerchandisingIntelligence {
  const historyByProduct = new Map(history.map((h) => [h.productId, h]));
  const generatedAt = new Date().toISOString();

  const reorderSuggestions: ReorderSuggestion[] = [];
  const slowMovers: SlowMover[] = [];
  const promoIdeas: PromoIdea[] = [];
  let lockedInventoryValue = 0;

  for (const product of products) {
    const h = historyByProduct.get(product.id);
    const velocity = velocityOf(historyByProduct, product.id);
    const cover = daysOfCoverOf(product.stock, velocity);
    const locked = product.stock * (product.costPrice || product.price || 0);
    lockedInventoryValue += locked;

    // ---- Reorder intelligence ----
    if (velocity > 0) {
      const suggestedOrderQty = Math.max(0, Math.ceil(targetCoverDays * velocity - product.stock));
      let urgency: ReorderSuggestion['urgency'] = 'ok';
      if (cover < 7) urgency = 'critical';
      else if (cover < 15) urgency = 'low';

      if (cover < targetCoverDays && suggestedOrderQty > 0) {
        reorderSuggestions.push({
          productId: product.id,
          name: product.name,
          slug: product.slug,
          category: product.category,
          currentStock: product.stock,
          avgDailySales: Math.round(velocity * 100) / 100,
          daysOfCover: cover === Number.POSITIVE_INFINITY ? 999 : Math.round(cover * 10) / 10,
          targetCoverDays,
          suggestedOrderQty,
          urgency,
        });
      }
    } else if (product.stock <= (product.lowStockThreshold || 0)) {
      // No demand *and* nearly out of stock — stale risk rather than reorder.
      reorderSuggestions.push({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        category: product.category,
        currentStock: product.stock,
        avgDailySales: 0,
        daysOfCover: 0,
        targetCoverDays,
        suggestedOrderQty: 0,
        urgency: 'stale',
      });
    }

    // ---- Slow mover / dead stock ----
    const units90 = historyByProduct.get(product.id)?.unitsSold || 0;
    if (product.stock > 0 && cover > 60) {
      const dead = units90 === 0;
      slowMovers.push({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        category: product.category,
        currentStock: product.stock,
        unitsSold90d: units90,
        daysOfCover: cover === Number.POSITIVE_INFINITY ? 999 : Math.round(cover),
        lockedValue: Math.round(locked),
        status: dead ? 'dead' : 'slow',
      });
    }

    // ---- Promo intelligence ----
    const isPromoStock = cover >= 60 || (product.stock > 0 && units90 === 0);
    const estMargin = marginPct(product);
    // Only pitch a discount when there's margin to give and inventory pressure.
    if (isPromoStock && estMargin !== null && estMargin >= 15) {
      const maxSafeDiscount = Math.min(35, Math.floor(estMargin * 0.45));
      const suggestedDiscountPct = Math.max(5, Math.min(maxSafeDiscount, cover >= 120 ? 30 : 20));
      const suggestedPrice = Math.round(product.price * (1 - suggestedDiscountPct / 100));
      const reason: PromoIdea['reason'] =
        units90 === 0 ? 'margin_clearance'
        : cover >= 120 ? 'stock_pressure'
        : 'low_velocity';
      promoIdeas.push({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        category: product.category,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        currentStock: product.stock,
        daysOfCover: cover === Number.POSITIVE_INFINITY ? 999 : Math.round(cover),
        estimatedMarginPct: Math.round(estMargin),
        suggestedDiscountPct,
        suggestedPrice,
        reason,
      });
    }
  }

  reorderSuggestions.sort((a, b) => {
    const rank = { critical: 0, low: 1, ok: 2, stale: 3 } as Record<ReorderSuggestion['urgency'], number>;
    return rank[a.urgency] - rank[b.urgency] || b.avgDailySales - a.avgDailySales;
  });

  slowMovers.sort((a, b) => b.daysOfCover - a.daysOfCover);

  promoIdeas.sort((a, b) => {
    const rank = { margin_clearance: 0, stock_pressure: 1, low_velocity: 2 } as Record<PromoIdea['reason'], number>;
    return rank[a.reason] - rank[b.reason] || b.suggestedDiscountPct - a.suggestedDiscountPct;
  });

  return {
    generatedAt,
    reorderSuggestions: reorderSuggestions.slice(0, 40),
    slowMovers: slowMovers.slice(0, 40),
    promoIdeas: promoIdeas.slice(0, 40),
    summary: {
      criticalRestockProducts: reorderSuggestions.filter((r) => r.urgency === 'critical').length,
      deadStockProducts: slowMovers.filter((s) => s.status === 'dead').length,
      promoPotentialProducts: promoIdeas.length,
      lockedInventoryValue: Math.round(lockedInventoryValue),
    },
  };
}

/** Build a flat sales history per product from order line items (90-day window). */
export function buildSalesHistory(
  orderItems: Array<{ product: string; quantity: number; createdAt?: Date }>,
  now: Date = new Date()
): SalesHistory[] {
  const cutoff = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  const byProduct = new Map<string, { unitsSold: number; lastOrderAt?: string }>();

  for (const item of orderItems) {
    if (item.createdAt && item.createdAt < cutoff) continue;
    const entry = byProduct.get(item.product) || { unitsSold: 0 };
    entry.unitsSold += item.quantity || 0;
    if (item.createdAt && (!entry.lastOrderAt || item.createdAt > new Date(entry.lastOrderAt))) {
      entry.lastOrderAt = item.createdAt.toISOString();
    }
    byProduct.set(item.product, entry);
  }

  return [...byProduct.entries()].map(([productId, v]) => ({
    productId,
    unitsSold: v.unitsSold,
    windowDays: 90,
    lastOrderAt: v.lastOrderAt,
  }));
}