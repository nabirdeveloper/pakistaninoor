import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Page from '@/models/Page';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// GET /api/admin/pages — list pages (any status), optional search
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const search = request.nextUrl.searchParams.get('search');
    const query: any = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const pages = await Page.find(query).sort({ updatedAt: -1 }).lean();

    return NextResponse.json({ pages });
  } catch (error: any) {
    console.error('Admin pages list error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load pages' },
      { status: 500 }
    );
  }
}

// POST /api/admin/pages — create a page
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const body = await request.json();
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!body.content || !body.content.trim()) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    let slug = body.slug?.trim() || slugify(body.title);
    while (await Page.exists({ slug })) {
      slug = `${slugify(body.title)}-${Date.now().toString(36)}`;
    }

    const page = await Page.create({
      title: body.title.trim(),
      slug,
      content: body.content,
      status: body.status || 'draft',
      metaTitle: body.metaTitle || undefined,
      metaDescription: body.metaDescription || undefined,
    });

    return NextResponse.json({ page }, { status: 201 });
  } catch (error: any) {
    console.error('Admin page create error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create page' },
      { status: 500 }
    );
  }
}