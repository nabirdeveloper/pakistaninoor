import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Blog from '@/models/Blog';

// GET /api/blog/[slug] — single published post; increments view count
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDB();

    const { slug } = await params;

    const post = await Blog.findOneAndUpdate(
      { slug, status: 'published', publishedAt: { $lte: new Date() } },
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .populate('author', 'name')
      .lean();

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error: any) {
    console.error('Blog post fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load post' },
      { status: 500 }
    );
  }
}