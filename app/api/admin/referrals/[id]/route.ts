import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Referral from '@/models/Referral';

/**
 * PATCH /api/admin/referrals/:id
 * Body: { bonus: 'referrer' | 'referred', paid: boolean }
 * Marks the referrer or referred bonus as paid / unpaid.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await connectDB();

    const { id } = await params;
    const body = await request.json();

    const field =
      body.bonus === 'referred' ? 'referredBonusPaid' : 'referrerBonusPaid';
    const paid = body.paid === true;

    const referral = await Referral.findByIdAndUpdate(
      id,
      { $set: { [field]: paid } },
      { new: true }
    )
      .populate('referrer', 'name email')
      .populate('referred', 'name email')
      .lean();

    if (!referral) {
      return NextResponse.json(
        { error: 'Referral not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ referral });
  } catch (error: any) {
    console.error('Referral update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update referral' },
      { status: 500 }
    );
  }
}