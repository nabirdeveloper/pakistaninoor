import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Notification from '@/models/Notification';
import { auth } from '@/auth';
import { z } from 'zod';

/**
 * POST /api/notifications/read
 *
 * Marks one notification as read ({ id }) or all as read (no id).
 */

const readSchema = z.object({
  id: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    await connectDB();

    const body = await request.json().catch(() => null);
    const parsed = readSchema.safeParse(body ?? {});
    const now = new Date();

    if (parsed.success && parsed.data.id) {
      const result = await Notification.updateOne(
        { _id: parsed.data.id, user: userId },
        { $set: { isRead: true, readAt: now } }
      );
      return NextResponse.json(
        { message: 'Notification marked as read', updated: result.modifiedCount },
        { status: 200 }
      );
    }

    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true, readAt: now } }
    );
    return NextResponse.json(
      { message: 'All notifications marked as read', updated: result.modifiedCount },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error marking notifications read:', error);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}