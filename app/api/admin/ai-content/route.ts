import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  ai,
  localGenerateDescription,
  localOptimizeSEO,
  localGenerateTags,
  localDraftReviewReply,
} from '@/lib/ai/client';

/**
 * POST /api/admin/ai-content
 *
 * Admin-only proxy for the AI content-generation endpoints. Every action has a
 * deterministic local fallback so the admin tools keep working when the AI
 * microservice is unreachable.
 *
 * Body:
 *  - { action: 'description', name, category?, features?, price?, brand? }
 *  - { action: 'seo', title, description?, category?, keywords? }
 *  - { action: 'tags', name, description?, category?, existingTags?, limit? }
 *  - { action: 'reviewReply', reviewText, rating?, productName?, customerName? }
 *
 * Returns { result, source: 'ai' | 'local' }.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body?.action;

    if (action === 'description') {
      const { name, category, features, price, brand } = body;
      if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
      }
      const normalized = {
        name,
        category: category || 'General',
        features: Array.isArray(features) ? features.filter((f: unknown) => typeof f === 'string') : [],
        price: typeof price === 'number' ? price : 0,
        brand: typeof brand === 'string' ? brand : undefined,
      };
      const remote = await ai.generateDescription(normalized);
      if (remote?.full_description && remote?.short_description) {
        return NextResponse.json({ result: remote, source: 'ai' });
      }
      const result = localGenerateDescription(normalized);
      return NextResponse.json({ result, source: 'local' });
    }

    if (action === 'seo') {
      const { title, description, category, keywords } = body;
      if (!title || typeof title !== 'string') {
        return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
      }
      const normalized = {
        title,
        description: typeof description === 'string' ? description : '',
        category: category || 'General',
        keywords: Array.isArray(keywords) ? keywords.filter((k: unknown) => typeof k === 'string') : [],
      };
      const remote = await ai.optimizeSEO(normalized);
      if (remote?.meta_title && remote?.meta_description) {
        return NextResponse.json({ result: remote, source: 'ai' });
      }
      const result = localOptimizeSEO(normalized);
      return NextResponse.json({ result, source: 'local' });
    }

    if (action === 'tags') {
      const { name, description, category, existingTags, limit } = body;
      if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
      }
      const limitNum = typeof limit === 'number' && limit > 0 ? Math.min(limit, 20) : 8;
      const normalized = {
        name,
        description: typeof description === 'string' ? description : undefined,
        category: typeof category === 'string' ? category : undefined,
        existingTags: Array.isArray(existingTags)
          ? existingTags.filter((t: unknown) => typeof t === 'string')
          : undefined,
        limit: limitNum,
      };
      const remote = await ai.generateTags(normalized);
      if (remote?.tags && remote.tags.length > 0) {
        return NextResponse.json({ result: remote, source: 'ai' });
      }
      const result = localGenerateTags(normalized);
      return NextResponse.json({ result, source: 'local' });
    }

    if (action === 'reviewReply') {
      const { reviewText, rating, productName, customerName } = body;
      if (!reviewText || typeof reviewText !== 'string') {
        return NextResponse.json({ error: 'Review text is required' }, { status: 400 });
      }
      const normalized = {
        reviewText,
        rating: typeof rating === 'number' && rating >= 1 && rating <= 5 ? rating : undefined,
        productName: typeof productName === 'string' ? productName : undefined,
        customerName: typeof customerName === 'string' ? customerName : undefined,
      };
      const remote = await ai.draftReviewReply(normalized);
      if (remote?.reply && remote.reply.trim().length > 0) {
        return NextResponse.json({ result: remote, source: 'ai' });
      }
      const result = localDraftReviewReply(normalized);
      return NextResponse.json({ result, source: 'local' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error in admin ai-content:', error);
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  }
}