import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Category from '@/models/Category';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const categories = await Category.find()
      .sort({ level: 1, name: 1 })
      .lean();

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error('Admin categories fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const body = await request.json();

    // Calculate level based on parent
    let level = 0;
    if (body.parent) {
      const parent = await Category.findById(body.parent);
      if (parent) {
        level = parent.level + 1;
      }
    }

    const category = new Category({
      ...body,
      level,
    });
    await category.save();

    return NextResponse.json({ category }, { status: 201 });
  } catch (error: any) {
    console.error('Admin category create error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}
