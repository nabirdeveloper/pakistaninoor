import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Banner from '@/models/Banner';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const banners = await Banner.find()
      .sort({ position: 1, order: 1 })
      .lean();

    return NextResponse.json({ banners });
  } catch (error: any) {
    console.error('Admin banners fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch banners' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const body = await request.json();

    const banner = new Banner(body);
    await banner.save();

    return NextResponse.json({ banner }, { status: 201 });
  } catch (error: any) {
    console.error('Admin banner create error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create banner' },
      { status: 500 }
    );
  }
}
