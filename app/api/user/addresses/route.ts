import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db/mongodb';
import User from '@/models/User';

// GET - Fetch user's addresses
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.user.id).select('addresses');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ addresses: user.addresses });
  } catch (error) {
    console.error('Failed to fetch addresses:', error);
    return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 });
  }
}

// POST - Add new address
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { label, fullName, phone, street, city, district, division, postalCode, isDefault } = body;

    if (!fullName || !phone || !street || !city || !district || !division || !postalCode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      user.addresses.forEach((addr: any) => {
        addr.isDefault = false;
      });
    }

    // If this is the first address, make it default
    const shouldBeDefault = isDefault || user.addresses.length === 0;

    user.addresses.push({
      label: label || 'Home',
      fullName,
      phone,
      street,
      city,
      district,
      division,
      postalCode,
      country: 'Bangladesh',
      isDefault: shouldBeDefault,
    });

    await user.save();

    return NextResponse.json({
      message: 'Address added successfully',
      addresses: user.addresses,
    });
  } catch (error) {
    console.error('Failed to add address:', error);
    return NextResponse.json({ error: 'Failed to add address' }, { status: 500 });
  }
}
