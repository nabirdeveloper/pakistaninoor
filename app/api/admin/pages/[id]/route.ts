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

// GET /api/admin/pages/[id] — single page
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const page = await Page.findById(id).lean();
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    return NextResponse.json({ page });
  } catch (error: any) {
    console.error('Admin page fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load page' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/pages/[id] — update a page
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    const existing = await Page.findById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const updates: any = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.status !== undefined) updates.status = body.status;
    if (body.metaTitle !== undefined) updates.metaTitle = body.metaTitle;
    if (body.metaDescription !== undefined)
      updates.metaDescription = body.metaDescription;

    if (body.slug !== undefined && body.slug.trim()) {
      let slug = body.slug.trim();
      let candidate = slug;
      let n = 2;
      while (await Page.exists({ slug: candidate, _id: { $ne: id } })) {
        candidate = `${slug}-${n}`;
        n += 1;
      }
      updates.slug = candidate;
    } else if (
      body.title !== undefined &&
      body.title !== existing.title &&
      !body.keepSlug
    ) {
      let slug = slugify(body.title);
      let candidate = slug;
      let n = 2;
      while (await Page.exists({ slug: candidate, _id: { $ne: id } })) {
        candidate = `${slug}-${n}`;
        n += 1;
      }
      updates.slug = candidate;
    }

    const page = await Page.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();

    return NextResponse.json({ page });
  } catch (error: any) {
    console.error('Admin page update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update page' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/pages/[id] — remove a page
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const page = await Page.findByIdAndDelete(id);
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Page deleted' });
  } catch (error: any) {
    console.error('Admin page delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete page' },
      { status: 500 }
    );
  }
}