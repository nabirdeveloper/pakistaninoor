import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Category from '@/models/Category';
import { auth } from '@/auth';

// GET - List all categories
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const parent = searchParams.get('parent');
    const showInMenu = searchParams.get('showInMenu');
    const featured = searchParams.get('featured');
    const flat = searchParams.get('flat'); // Return flat list vs tree

    const query: any = { isActive: true };

    if (parent) {
      if (parent !== 'all') {
        query.parent = parent;
      }
    } else if (parent === null || !flat) {
      query.parent = null; // Root categories only
    }

    if (showInMenu === 'true') {
      query.showInMenu = true;
    }

    if (featured === 'true') {
      query.isFeatured = true;
    }

    const categories = await Category.find(query)
      .populate({
        path: 'children',
        match: { isActive: true },
        options: { sort: { sortOrder: 1 } },
        populate: {
          path: 'children',
          match: { isActive: true },
          options: { sort: { sortOrder: 1 } },
        },
      })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// POST - Create new category (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();

    // Generate slug if not provided
    if (!body.slug) {
      body.slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Check if slug exists
      const existingSlug = await Category.findOne({ slug: body.slug });
      if (existingSlug) {
        body.slug = `${body.slug}-${Date.now().toString(36)}`;
      }
    }

    const category = await Category.create(body);

    return NextResponse.json(
      { message: 'Category created successfully', category },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}
