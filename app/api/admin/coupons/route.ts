import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Coupon from '@/models/Coupon';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const coupons = await Coupon.find()
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ coupons });
  } catch (error: any) {
    console.error('Admin coupons fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch coupons' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const body = await request.json();

    // Check if code already exists
    const existing = await Coupon.findOne({ code: body.code.toUpperCase() });
    if (existing) {
      return NextResponse.json(
        { error: 'Coupon code already exists' },
        { status: 400 }
      );
    }

    const coupon = new Coupon({
      ...body,
      code: body.code.toUpperCase(),
    });
    await coupon.save();

    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error: any) {
    console.error('Admin coupon create error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create coupon' },
      { status: 500 }
    );
  }
}
