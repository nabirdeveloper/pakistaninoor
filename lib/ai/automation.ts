/**
 * AI Automation Runner (Phase 6)
 * ==============================
 * Deterministic-first storefront automation that always runs (zero keys, works
 * with the AI service down):
 *
 *   1. Low-stock reorder  — scans tracked inventory and flags every SKU at or
 *      below its low-stock threshold, plus a suggested reorder quantity so the
 *      purchasing team knows exactly what to order.
 *   2. Order-status alerts — scans in-flight orders and flags any that have
 *      sat in the same status past its SLA window, so ops can chase the courier
 *      / customer before they open a support ticket.
 *
 * The engine is 100% deterministic (rules) — the Python AI service upgrades it
 * to an LLM "run plan" when a key is configured, but the local result is the
 * always-true baseline (mirrors the Phase-5 support-triage contract).
 */

import { checkProductAlerts } from '@/lib/notifications/checkProductAlerts';
import { notifyUser } from '@/lib/notifications/push';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReorderUrgency = 'critical' | 'high' | 'medium';

export interface LowStockProductInput {
  _id: string;
  name: string;
  slug: string;
  sku: string;
  images?: Array<{ url: string; isPrimary?: boolean }>;
  stock: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  price: number;
  compareAtPrice?: number;
}

/** Previous snapshot for a product — used to detect back-in-stock restocks. */
export interface ProductSnapshotInput {
  id: string;
  stock: number;
  price: number;
  compareAtPrice?: number;
}

export interface OrderStatusInput {
  _id: string;
  orderNumber: string;
  status: string;
  updatedAt: string | Date;
  user?: string;
  itemCount?: number;
}

export interface ReorderSuggestion {
  productId: string;
  sku: string;
  name: string;
  slug: string;
  currentStock: number;
  lowStockThreshold: number;
  suggestedReorderQty: number;
  urgency: ReorderUrgency;
  backorderAllowed: boolean;
}

export interface OrderStatusAlert {
  orderId: string;
  orderNumber: string;
  status: string;
  stuckForHours: number;
  slaLimitHours: number;
  breached: boolean;
  recommendedAction: string;
  message: string;
  userId?: string;
}

export interface AutomationResult {
  generated_at: string;
  engine: 'rules';
  summary: {
    trackedLowStock: number;
    criticalStock: number;
    inboundOrdersOverdue: number;
    totalOrdersScanned: number;
  };
  lowStock: ReorderSuggestion[];
  orderAlerts: OrderStatusAlert[];
}

export interface AutomationInput {
  products: LowStockProductInput[];
  prevSnapshots?: ProductSnapshotInput[];
  orders: OrderStatusInput[];
  staleSlaHours?: Partial<Record<string, number>>;
  fireNotifications?: boolean;
}

// ---------------------------------------------------------------------------
// Deterministic engine
// ---------------------------------------------------------------------------

const DEFAULT_SLA_HOURS: Record<string, number> = {
  pending: 12,
  confirmed: 12,
  processing: 24,
  packed: 24,
  shipped: 72,
  shipped_and_holding: 72,
  out_for_delivery: 48,
  cancelled: 0,
  returned: 0,
  refunded: 0,
  delivered: 0,
};

export function localAutomationRun(input: AutomationInput): AutomationResult {
  const now = new Date().toISOString();
  const sla = { ...DEFAULT_SLA_HOURS, ...(input.staleSlaHours || {}) };
  const prevById = new Map((input.prevSnapshots || []).map((s) => [s.id, s]));

  // ---- 1) Low-stock reorder ----
  const lowStock: ReorderSuggestion[] = [];
  let trackedLowStock = 0;
  let criticalStock = 0;
  for (const p of (input.products || []).filter((p) => p.trackInventory)) {
    if (p.stock <= p.lowStockThreshold || p.stock === 0) {
      trackedLowStock += 1;
      if (p.stock <= Math.max(1, Math.round(p.lowStockThreshold / 2))) criticalStock += 1;
      // Suggested reorder: enough to cover 2x the threshold, rounded to a
      // shelf-friendly quantity (min 1 for zero-stock critical items).
      const targetQty = Math.max(p.lowStockThreshold * 2, 1);
      const suggestedReorderQty = Math.max(targetQty - p.stock, p.stock === 0 ? Math.max(1, p.lowStockThreshold) : 1);
      const urgency: ReorderUrgency = p.stock === 0 ? 'critical' : p.stock <= Math.round(p.lowStockThreshold / 2) ? 'high' : 'medium';
      lowStock.push({
        productId: p._id,
        sku: p.sku,
        name: p.name,
        slug: p.slug,
        currentStock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        suggestedReorderQty,
        urgency,
        backorderAllowed: p.allowBackorder,
      });
    }
  }

  // ---- 2) Order-status alerts ----
  const orderAlerts: OrderStatusAlert[] = [];
  let inboundOrdersOverdue = 0;
  for (const o of (input.orders || [])) {
    const limit = sla[o.status] ?? 48;
    if (limit <= 0) continue;
    const updatedAt = typeof o.updatedAt === 'string' ? new Date(o.updatedAt) : o.updatedAt;
    const stuckForHours = updatedAt ? Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 3_600_000) : 0;
    const breached = stuckForHours > limit;
    if (!breached && stuckForHours < limit * 0.6) continue;
    if (breached) inboundOrdersOverdue += 1;
    orderAlerts.push({
      orderId: o._id,
      orderNumber: o.orderNumber,
      status: o.status,
      stuckForHours: Math.round(stuckForHours * 10) / 10,
      slaLimitHours: limit,
      breached,
      recommendedAction: breached ? 'escalate' : 'monitor',
      message: `Order ${o.orderNumber} is ${o.status} — ≈${Math.round(stuckForHours)}h without an update (SLA ${limit}h).`,
      userId: o.user,
    });
  }

  return {
    generated_at: now,
    engine: 'rules',
    summary: {
      trackedLowStock,
      criticalStock,
      inboundOrdersOverdue,
      totalOrdersScanned: (input.orders || []).length,
    },
    lowStock,
    orderAlerts,
  };
}

// ---------------------------------------------------------------------------
// Orchestrator — deterministic First + push with AI-service upgrade hook.
//
// `fireNotifications` reuses the shared push primitive (notifyUser) for stale
// orders and the Phase-4 product-alert engine (checkProductAlerts) to notify
// back-in-stock subscribers when a tracked product was restocked. Deterministic
// and local: exactly the Phase-5 "always runs, no external deps" contract.
// ---------------------------------------------------------------------------

export async function runAutomations(input: AutomationInput): Promise<AutomationResult & { notificationsFired: number }> {
  const local = localAutomationRun(input);
  let notificationsFired = 0;
  const prevById = new Map((input.prevSnapshots || []).map((s) => [s.id, s]));

  if (input.fireNotifications) {
    // Back-in-stock restraint: restocked tracked products notify subscribers.
    for (const p of (input.products || []).filter((p) => p.trackInventory)) {
      const prev = prevById.get(p._id);
      if (prev && prev.stock <= 0 && p.stock > 0) {
        await checkProductAlerts(
          { stock: prev.stock, price: prev.price, compareAtPrice: prev.compareAtPrice },
          {
            _id: p._id as any,
            name: p.name,
            slug: p.slug,
            images: p.images,
            stock: p.stock,
            price: p.price,
            compareAtPrice: p.compareAtPrice,
          }
        );
      }
    }

    for (const alert of local.orderAlerts) {
      if (!alert.breached || !alert.userId) continue;
      await notifyUser({
        userId: alert.userId,
        type: 'system',
        title: `Order ${alert.orderNumber} needs attention`,
        message: alert.message,
        link: `/admin/orders?q=${alert.orderNumber}`,
        data: { automation: 'order_status', orderId: alert.orderId },
      });
      notificationsFired += 1;
    }
  }

  return { ...local, notificationsFired };
}