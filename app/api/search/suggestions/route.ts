import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import { ai, localSearchSuggestions } from '@/lib/ai/client';

/**
 * GET /api/search/suggestions?q=...&limit=8
 *
 * AI-powered search suggestions + typo-tolerant "did you mean".
 * Pulls a bounded product/category catalog from the DB, asks the AI
 * microservice, and falls back to a deterministic local matcher when
 * the AI service is unavailable. Never throws.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().slice(0, 100);
    const limit = Math.min(parseInt(searchParams.get('limit') || '8'), 12);

    await connectDB();

    // Bounded catalog for the AI service (top sellers first, capped at 200).
    const [products, categories] = await Promise.all([
      Product.find({
        status: 'active',
        visibility: { $in: ['visible', 'catalog', 'search'] },
      })
        .select('name slug tags salesCount')
        .sort({ salesCount: -1, viewCount: -1 })
        .limit(200)
        .lean(),
      Category.find({ isActive: true })
        .select('name slug')
        .sort({ sortOrder: 1, name: 1 })
        .limit(50)
        .lean(),
    ]);

    const productPayload = products.map((p: { _id: unknown; name: string; slug: string; tags?: string[]; salesCount?: number }) => ({
      id: String(p._id),
      name: p.name,
      slug: p.slug,
      tags: p.tags || [],
      salesCount: p.salesCount || 0,
    }));
    const categoryPayload = categories.map((c: { _id: unknown; name: string; slug: string }) => ({
      id: String(c._id),
      name: c.name,
      slug: c.slug,
    }));

    if (!q) {
      // Empty query → trending behavior is handled client-side; return nothing.
      return NextResponse.json({
        suggestions: [],
        didYouMean: null,
        correctedQuery: null,
        source: 'local',
      });
    }

    const aiResult = await ai.searchSuggestions({
      q,
      products: productPayload,
      categories: categoryPayload,
      limit,
    });

    if (aiResult) {
      return NextResponse.json({ ...aiResult, source: 'ai' });
    }

    const localResult = localSearchSuggestions({ q, products: productPayload, limit });
    return NextResponse.json({ ...localResult, source: 'local' });
  } catch (error) {
    console.error('Error in search suggestions:', error);
    return NextResponse.json(
      { suggestions: [], didYouMean: null, correctedQuery: null, source: 'local' },
      { status: 200 }
    );
  }
}