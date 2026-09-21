import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import Order from '@/models/Order';
import { auth } from '@/auth';

import {
  localAutomationRun,
  runAutomations,
  type AutomationInput,
  type AutomationResult,
} from '@/lib/ai/automation';

type AdminAutomation = { error?: string; [k: string]: unknown };

// GET /api/admin/automation - Phase 6 automation runner. Deterministic engine
// (localAutomationRun) always runs - zero keys, works with the AI service
// down - and produces:
//
//   1. Low-stock reorder suggestions: every tracked product at or below its
//      low-stock threshold, with a suggested reorder quantity + urgency so
//      the purchasing team knows exactly what to restock.
//   2. Order-status alerts: every in-flight order stuck in the same status
//      past its SLA window, so ops can chase the courier / customer before
//      they open a support ticket.
//
// The engine reuses the Phase-4 building blocks (checkProductAlerts for
// back-in-stock restock detection + notifyUser for the push), which is the
// deterministic-first contract that always works.
//
//   GET  ?fire=1  -> run the async orchestrator too (fires the shared in-app
//                    notifications via notifyUser for breached alerts)
//   GET  (default)-> deterministic localAutomationRun only (read-only plan)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (
      !session ||
      (session.user.role !== 'admin' && session.user.role !== 'superadmin')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const fire = searchParams.get('fire') === '1';
    const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit') || 200)));

    // ---- 1) Low-stock scan: every tracked, active product at or below its
    //      low-stock threshold (tracked inventory only). ----
    const products = await Product.find({
      trackInventory: true,
      status: 'active',
    })
      .select('name slug sku images stock lowStockThreshold trackInventory allowBackorder price compareAtPrice')
      .sort({ stock: 1 })
      .limit(limit)
      .lean();

    const inFlightProducts = products
      .filter((p: any) => p.stock <= p.lowStockThreshold)
      .map((p: any) => ({
        _id: String(p._id),
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        images: p.images,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        trackInventory: p.trackInventory,
        allowBackorder: p.allowBackorder,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
      }));

    // ---- 2) In-flight order scan: every order not in a terminal status,
    //      so the SLA scan can flag statuses that have gone stale. ----
    const inFlightStatuses = [
      'pending',
      'confirmed',
      'processing',
      'packed',
      'shipped',
      'out_for_delivery',
    ];
    const orders = await Order.find({ status: { $in: inFlightStatuses } })
      .select('orderNumber status updatedAt user')
      .sort({ updatedAt: 1 })
      .limit(limit)
      .lean();

    const orderInputs = orders.map((o: any) => ({
      _id: String(o._id),
      orderNumber: o.orderNumber,
      status: o.status,
      updatedAt: o.updatedAt,
      user: o.user ? String(o.user) : undefined,
      itemCount: o.itemCount,
    }));

    const input: AutomationInput = {
      products: inFlightProducts,
      prevSnapshots: [],
      orders: orderInputs,
    };

    // Deterministic engine always runs (works with the AI service down).
    const local = localAutomationRun(input);
    const decided = fire ? await runAutomations(input) : local;

    const summary = {
      lowStock: decided.summary.trackedLowStock,
      critical: decided.summary.criticalStock,
      orderAlerts: decided.orderAlerts.length,
      totalOrders: decided.summary.totalOrdersScanned,
    };

    return NextResponse.json({
      generated_at: decided.generated_at,
      engine: decided.engine,
      source: 'automation:rules',
      summary,
      lowStock: decided.lowStock,
      orderAlerts: decided.orderAlerts,
      fire,
    });
  } catch (error: any) {
    console.error('Admin automation runner error:', error);
    return NextResponse.json(
      { error: 'Failed to run automations' },
      { status: 500 }
    );
  }
}