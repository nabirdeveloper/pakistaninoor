import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Blog from '@/models/Blog';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// GET /api/admin/blog — list posts (any status) with search + status filter
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const posts = await Blog.find(query)
      .populate('author', 'name')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      posts: posts.map((p: any) => ({
        ...p,
        authorName: p.author?.name,
      })),
    });
  } catch (error: any) {
    console.error('Admin blog list error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load posts' },
      { status: 500 }
    );
  }
}

// POST /api/admin/blog — create a post (draft by default unless status=published)
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const { title, content, status = 'draft' } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }
    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    let slug = body.slug?.trim() || slugify(title);
    while (await Blog.exists({ slug })) {
      slug = `${slugify(title)}-${Date.now().toString(36)}`;
    }

    const post = await Blog.create({
      title: title.trim(),
      slug,
      excerpt: body.excerpt || '',
      content,
      featuredImage: body.featuredImage || '',
      featuredImagePublicId: '',
      author: new mongoose.Types.ObjectId(session.user.id),
      category: body.category || 'Shopping',
      tags: Array.isArray(body.tags)
        ? body.tags.filter(Boolean)
        : typeof body.tags === 'string' && body.tags.trim()
        ? body.tags
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [],
      metaTitle: body.metaTitle || undefined,
      metaDescription: body.metaDescription || undefined,
      metaKeywords: Array.isArray(body.metaKeywords)
        ? body.metaKeywords
        : typeof body.metaKeywords === 'string' && body.metaKeywords.trim()
        ? body.metaKeywords
            .split(',')
            .map((k: string) => k.trim())
            .filter(Boolean)
        : [],
      status,
      publishedAt:
        status === 'published' ? new Date() : undefined,
      aiGenerated: !!body.aiGenerated,
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error: any) {
    console.error('Admin blog create error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create post' },
      { status: 500 }
    );
  }
}