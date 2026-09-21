import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Referral from '@/models/Referral';

// GET /api/admin/referrals — referral overview + list
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const status = request.nextUrl.searchParams.get('status');
    const search = request.nextUrl.searchParams.get('search');

    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const [stats, referrals, all] = await Promise.all([
      Referral.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
            expired: {
              $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] },
            },
            bonusPaid: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'completed'] },
                  {
                    $add: [
                      { $cond: ['$referrerBonusPaid', '$referrerBonus', 0] },
                      { $cond: ['$referredBonusPaid', '$referredBonus', 0] },
                    ],
                  },
                  0,
                ],
              },
            },
          },
        },
      ]),
      Referral.find(query)
        .populate('referrer', 'name email phone loyaltyPoints')
        .populate('referred', 'name email phone loyaltyPoints')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      Referral.find({})
        .select('referrer referred status')
        .lean(),
    ]);

    // Filter by customer name/email when searching
    let list = referrals;
    if (search) {
      const rx = new RegExp(search, 'i');
      list = referrals.filter((r: any) =>
        (r.referrer?.name || '').match(rx) ||
        (r.referrer?.email || '').match(rx) ||
        (r.referred?.name || '').match(rx) ||
        (r.referred?.email || '').match(rx)
      );
    }

    // Track unique customers who referred someone
    const referrerIds = new Set(
      all.map((r: any) => r.referrer?.toString())
    );

    return NextResponse.json({
      stats: stats[0] || {
        total: 0,
        completed: 0,
        pending: 0,
        expired: 0,
        bonusPaid: 0,
      },
      activeReferrers: referrerIds.size,
      referrals: list.map((r: any) => ({
        ...r,
        referrerName: r.referrer?.name,
        referrerEmail: r.referrer?.email,
        referrerPhone: r.referrer?.phone,
        referredName: r.referred?.name,
        referredEmail: r.referred?.email,
        referredPhone: r.referred?.phone,
      })),
    });
  } catch (error: any) {
    console.error('Referrals list error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load referrals' },
      { status: 500 }
    );
  }
}