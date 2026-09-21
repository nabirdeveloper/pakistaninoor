import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Blog from '@/models/Blog';

// GET /api/blog — published posts, paginated, optional category + search
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(
      24,
      Math.max(1, parseInt(searchParams.get('limit') || '9') || 9)
    );
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const query: any = {
      status: 'published',
      publishedAt: { $lte: new Date() },
    };
    if (category) {
      query.category = category;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const [posts, total] = await Promise.all([
      Blog.find(query)
        .select(
          'title slug excerpt content featuredImage category tags author status publishedAt viewCount likeCount aiGenerated'
        )
        .populate('author', 'name')
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Blog.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    console.error('Blog list error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load blog posts' },
      { status: 500 }
    );
  }
}