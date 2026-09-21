import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Coupon from '@/models/Coupon';

/**
 * GET /api/admin/campaigns
 * Groups coupons by their `campaign` tag and returns per-campaign stats
 * (coupon count, total redemptions, total discount given, active count)
 * plus the full coupon list so the page can assign/clear campaigns.
 *
 * Assigning a coupon to a campaign: PATCH /api/admin/coupons/:id { campaign }.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const search = request.nextUrl.searchParams.get('search');

    let queryQ: any = {};
    if (search) {
      queryQ = {
        $or: [
          { code: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } },
          { campaign: { $regex: search, $options: 'i' } },
        ],
      };
    }

    const coupons = await Coupon.find(queryQ).sort({ createdAt: -1 }).lean();

    const groups = new Map<
      string,
      {
        name: string;
        coupons: any[];
        couponCount: number;
        usedCount: number;
        discountAmount: number;
        activeCount: number;
      }
    >();

    for (const c of coupons as any[]) {
      const campaign = (c.campaign || '').trim();
      const key = campaign || '__uncategorized__';
      if (!groups.has(key)) {
        groups.set(key, {
          name: campaign || 'Uncategorized',
          coupons: [],
          couponCount: 0,
          usedCount: 0,
          discountAmount: 0,
          activeCount: 0,
        });
      }
      const g = groups.get(key)!;
      g.coupons.push({
        _id: c._id,
        code: c.code,
        name: c.name,
        type: c.type,
        value: c.value,
        isActive: c.isActive,
        usedCount: c.usedCount || 0,
        usage: Array.isArray(c.usage) && c.usage.length > 0
          ? (c.usage as any[]).reduce(
              (sum: number, u: any) => sum + (u.discountAmount || 0),
              0
            )
          : 0,
        startDate: c.startDate,
        endDate: c.endDate,
      });
      g.couponCount += 1;
      g.usedCount += c.usedCount || 0;
      g.discountAmount += Array.isArray(c.usage)
        ? (c.usage as any[]).reduce(
            (sum: number, u: any) => sum + (u.discountAmount || 0),
            0
          )
        : 0;
      if (c.isActive) g.activeCount += 1;
    }

    const campaignGroups = Array.from(groups.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({
      groups: campaignGroups,
      totalCampaigns: campaignGroups.filter(
        (g) => g.name !== 'Uncategorized'
      ).length,
      totalCoupons: coupons.length,
    });
  } catch (error: any) {
    console.error('Campaigns list error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load campaigns' },
      { status: 500 }
    );
  }
}