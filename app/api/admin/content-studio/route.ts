import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Blog from '@/models/Blog';
import { auth } from '@/auth';
import {
  ai,
  type CampaignCopyResult,
  type BlogDraftResult,
} from '@/lib/ai/client';
import {
  generateCampaignCopy,
  generateBlogDraft,
  slugify,
  type CampaignCopyInput,
  type BlogDraftInput,
} from '@/lib/ai/contentStudio';

// GET /api/admin/content-studio — recent AI-generated blog drafts (for the drafts list)
export async function GET() {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const drafts = await Blog.find({ status: 'draft', aiGenerated: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('title slug excerpt category tags createdAt')
      .lean();

    return NextResponse.json({
      drafts: (drafts as any[]).map((d) => ({
        id: d._id.toString(),
        title: d.title,
        slug: d.slug,
        excerpt: d.excerpt,
        category: d.category,
        tags: d.tags || [],
        createdAt: d.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Content studio list error:', error);
    return NextResponse.json({ error: 'Failed to load drafts' }, { status: 500 });
  }
}

// POST /api/admin/content-studio — generate campaign copy or blog drafts
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tool } = body;

    if (tool === 'campaign') {
      const input: CampaignCopyInput = {
        productName: body.productName,
        offer: body.offer,
        audience: body.audience,
        channels: Array.isArray(body.channels) ? body.channels : ['email', 'push', 'sms'],
        tone: body.tone || 'friendly',
        deadline: body.deadline,
        market: body.market,
      };

      const result =
        (await ai.campaignCopy({
          productName: input.productName,
          offer: input.offer,
          audience: input.audience,
          channels: input.channels,
          tone: input.tone,
          deadline: input.deadline,
          market: input.market,
        })) || (generateCampaignCopy(input) as CampaignCopyResult);

      return NextResponse.json({ ...result, source: result.engine === 'llm' ? 'ai_service' : 'local_fallback' });
    }

    if (tool === 'blog') {
      const input: BlogDraftInput = {
        topic: String(body.topic || '').trim(),
        keywords: Array.isArray(body.keywords) ? body.keywords : [],
        audience: body.audience,
        category: body.category || 'Shopping',
      };

      if (!input.topic) {
        return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
      }

      const generated =
        (await ai.blogDraft({
          topic: input.topic,
          keywords: input.keywords,
          audience: input.audience,
          category: input.category,
        })) || (generateBlogDraft(input) as BlogDraftResult);

      const result = { ...generated, source: generated.engine === 'llm' ? 'ai_service' : 'local_fallback' };

      // Optionally persist the draft so it appears in the blog admin.
      if (body.saveDraft) {
        await connectDB();
        const baseSlug = generated.slug || slugify(generated.title || input.topic);
        let slug = baseSlug;
        let n = 2;
        // eslint-disable-next-line no-constant-condition
        while (await Blog.exists({ slug })) {
          slug = `${baseSlug}-${n}`;
          n += 1;
        }

        const content = (generated.sections || [])
          .map((s) => `## ${s.heading}\n\n${s.content}`)
          .join('\n\n');

        await Blog.create({
          title: generated.title,
          slug,
          excerpt: generated.excerpt,
          content,
          featuredImage: '',
          featuredImagePublicId: '',
          author: session.user.id,
          category: input.category || 'Shopping',
          tags: generated.keywords || [],
          metaTitle: generated.metaTitle,
          metaDescription: generated.metaDescription,
          metaKeywords: generated.keywords || [],
          status: 'draft',
          aiGenerated: true,
        });
        (result as any).savedAsDraft = true;
        (result as any).slug = slug;
      }

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown tool. Use "campaign" or "blog".' }, { status: 400 });
  } catch (error: any) {
    console.error('Content studio error:', error);
    return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
  }
}