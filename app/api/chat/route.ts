import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import { ai, localFAQChat, type ChatResult } from '@/lib/ai/client';
import { z } from 'zod';

/**
 * POST /api/chat
 *
 * Storefront AI assistant endpoint.
 *  - Sends the message (+ optional context) to the AI microservice with the
 *    product catalog so it can answer product questions.
 *  - Falls back to the in-app rule engine (localFAQChat) when the service is
 *    unreachable, so the widget keeps working with zero backend.
 */

const chatRequestSchema = z.object({
  message: z.string().min(1).max(500),
  context: z.record(z.string(), z.unknown()).optional(),
});

const ACTIVE_FILTER = { status: 'active', visibility: { $in: ['visible', 'catalog', 'search'] } };

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

/** Short TTL cache so /api/chat doesn't re-query the whole catalog per message. */
let cachedCatalog: { at: number; catalog: CatalogShape[] } | null = null;

async function loadCatalog(): Promise<CatalogShape[]> {
  if (cachedCatalog && Date.now() - cachedCatalog.at < 60_000) {
    return cachedCatalog.catalog;
  }
  await connectDB();
  const products = await Product.find(ACTIVE_FILTER)
    .populate('category', 'name slug')
    .select('name slug category tags description price salesCount averageRating images')
    .limit(300)
    .lean();

  const catalog = products.map(
    (p: {
      _id: unknown;
      name: string;
      slug: string;
      category?: { name?: string; _id?: unknown } | null;
      tags?: string[];
      description: string;
      price: number;
      salesCount?: number;
      averageRating?: number;
      images?: Array<{ url: string }>;
    }) => ({
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
    })
  );

  cachedCatalog = { at: Date.now(), catalog };
  return catalog;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request. Provide a non-empty message (max 500 chars).' },
        { status: 400 }
      );
    }

    const { message, context } = parsed.data;

    let result: ChatResult | null;
    try {
      const catalog = await loadCatalog();
      // Try the AI service first; always keep the local engine as a fallback.
      result = (await ai.chat({ message, context, catalog })) ?? localFAQChat({ message, context, catalog });
    } catch {
      result = localFAQChat({ message, context });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}