import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Blog from '@/models/Blog';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// GET /api/admin/blog/[id] — single post (for the editor)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const post = await Blog.findById(id).populate('author', 'name').lean();

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error: any) {
    console.error('Admin blog fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load post' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/blog/[id] — update a post
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    const existing = await Blog.findById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const updates: any = {
      title: body.title !== undefined ? body.title : existing.title,
      excerpt: body.excerpt !== undefined ? body.excerpt : existing.excerpt,
      content: body.content !== undefined ? body.content : existing.content,
      category: body.category !== undefined ? body.category : existing.category,
      featuredImage:
        body.featuredImage !== undefined
          ? body.featuredImage
          : existing.featuredImage,
      metaTitle: body.metaTitle !== undefined ? body.metaTitle : existing.metaTitle,
      metaDescription:
        body.metaDescription !== undefined
          ? body.metaDescription
          : existing.metaDescription,
    };

    // Tags / keywords: arrays preferred, comma strings accepted
    const parseList = (v: any): string[] | undefined =>
      v === undefined
        ? undefined
        : Array.isArray(v)
        ? v.filter(Boolean)
        : typeof v === 'string' && v.trim()
        ? v.split(',').map((x: string) => x.trim()).filter(Boolean)
        : [];
    const tags = parseList(body.tags);
    if (tags !== undefined) updates.tags = tags;
    const metaKeywords = parseList(body.metaKeywords);
    if (metaKeywords !== undefined) updates.metaKeywords = metaKeywords;

    // Slug (regenerate if title changed and slug wasn't explicit)
    if (body.slug !== undefined && body.slug.trim()) {
      let slug = body.slug.trim();
      if (slug !== existing.slug) {
        let candidate = slug;
        let n = 2;
        while (await Blog.exists({ slug: candidate, _id: { $ne: id } })) {
          candidate = `${slug}-${n}`;
          n += 1;
        }
        updates.slug = candidate;
      }
    } else if (
      body.title !== undefined &&
      body.title !== existing.title &&
      !body.keepSlug
    ) {
      let slug = slugify(body.title);
      let candidate = slug;
      let n = 2;
      while (await Blog.exists({ slug: candidate, _id: { $ne: id } })) {
        candidate = `${slug}-${n}`;
        n += 1;
      }
      updates.slug = candidate;
    }

    // Status changes
    if (body.status !== undefined && body.status !== existing.status) {
      updates.status = body.status;
      if (body.status === 'published' && !existing.publishedAt) {
        updates.publishedAt = new Date();
      }
      if (body.status !== 'published') {
        updates.publishedAt = undefined;
      }
    }

    const post = await Blog.findByIdAndUpdate(id, { $set: updates }, { new: true })
      .populate('author', 'name')
      .lean();

    return NextResponse.json({ post });
  } catch (error: any) {
    console.error('Admin blog update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update post' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/blog/[id] — remove a post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const post = await Blog.findByIdAndDelete(id);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Post deleted' });
  } catch (error: any) {
    console.error('Admin blog delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete post' },
      { status: 500 }
    );
  }
}