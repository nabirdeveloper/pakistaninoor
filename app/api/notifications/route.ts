import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import Notification from '@/models/Notification';
import { auth } from '@/auth';

/**
 * GET /api/notifications?limit=&unread=true
 *
 * Lists the signed-in customer's notifications (newest first) and the unread
 * count used by the header bell.
 */

interface NotificationRecord {
  _id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  image?: string;
  isRead: boolean;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    await connectDB();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 50);
    const onlyUnread = searchParams.get('unread') === 'true';

    const query: Record<string, unknown> = { user: userId };
    if (onlyUnread) query.isRead = false;

    const [records, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ user: userId, isRead: false }),
    ]);

    const notifications: NotificationRecord[] = records.map((n) => ({
      _id: String(n._id),
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      image: n.image,
      isRead: !!n.isRead,
      createdAt: String(n.createdAt),
    }));

    return NextResponse.json({ notifications, unreadCount }, { status: 200 });
  } catch (error) {
    console.error('Error listing notifications:', error);
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 });
  }
}