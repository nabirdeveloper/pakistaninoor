import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Settings from '@/models/Settings';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    let settings = await Settings.findOne().lean();

    if (!settings) {
      // Create default settings if none exist
      const newSettings = new Settings({
        siteName: 'Pakistani Noor',
        adminSecretKey: process.env.ADMIN_SECRET_KEY || 'change-this-secret-key',
      });
      await newSettings.save();
      settings = newSettings.toObject();
    }

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Admin settings fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    const body = await request.json();

    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings({
        ...body,
        adminSecretKey: body.adminSecretKey || process.env.ADMIN_SECRET_KEY || 'change-this-secret-key',
      });
    } else {
      // Deep merge updates
      Object.keys(body).forEach((key) => {
        if (body[key] !== undefined) {
          if (typeof body[key] === 'object' && !Array.isArray(body[key]) && body[key] !== null) {
            // Merge nested objects
            (settings as any)[key] = { ...(settings as any)[key]?.toObject?.() || (settings as any)[key], ...body[key] };
          } else {
            (settings as any)[key] = body[key];
          }
        }
      });
    }

    await settings.save();

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Admin settings update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}
