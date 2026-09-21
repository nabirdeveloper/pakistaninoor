import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Banner from '@/models/Banner';

// GET - Fetch banners
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const position = searchParams.get('position');
    const limit = parseInt(searchParams.get('limit') || '10');

    await connectDB();

    const query: any = { isActive: true };

    // Filter by position if specified
    if (position) {
      query.position = position;
    }

    // Check date validity
    const now = new Date();
    query.$and = [
      { $or: [{ startDate: { $lte: now } }, { startDate: { $exists: false } }] },
      { $or: [{ endDate: { $gte: now } }, { endDate: { $exists: false } }] },
    ];

    const banners = await Banner.find(query)
      .sort({ order: 1, createdAt: -1 })
      .limit(limit)
      .select('title subtitle description imageDesktop imageMobile link buttonText buttonStyle position order');

    return NextResponse.json({ banners });
  } catch (error) {
    console.error('Failed to fetch banners:', error);
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 });
  }
}
