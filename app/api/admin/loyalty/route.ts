import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';

// GET /api/admin/loyalty — loyalty program overview + top members
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const [topUsers, stats, settings] = await Promise.all([
      User.find({ loyaltyPoints: { $gt: 0 } })
        .select('name email phone loyaltyPoints referralCode createdAt')
        .sort({ loyaltyPoints: -1 })
        .limit(25)
        .lean(),
      User.aggregate([
        { $match: { loyaltyPoints: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            members: { $sum: 1 },
            totalPoints: { $sum: '$loyaltyPoints' },
            avgPoints: { $avg: '$loyaltyPoints' },
          },
        },
      ]),
      Settings.findOne({}).select('loyalty').lean(),
    ]);

    const s = stats[0] || { members: 0, totalPoints: 0, avgPoints: 0 };

    return NextResponse.json({
      stats: {
        members: s.members,
        totalPoints: s.totalPoints,
        avgPoints: Math.round(s.avgPoints || 0),
      },
      topUsers: topUsers.map((u: any) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        loyaltyPoints: u.loyaltyPoints,
        referralCode: u.referralCode,
      })),
      settings: (settings as any)?.loyalty || null,
    });
  } catch (error: any) {
    console.error('Loyalty overview error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load loyalty overview' },
      { status: 500 }
    );
  }
}