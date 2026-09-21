import { Types } from 'mongoose';
import Notification, { NotificationType } from '@/models/Notification';

/**
 * Shared in-app notification push. Callers must have `await connectDB()` active
 * (this helper performs no I/O itself beyond saving the document).
 *
 * Used for order lifecycle updates (Phase 4), back-in-stock / price-drop alerts
 * (Phase 4), and abandoned-cart recovery (Phase 3).
 */
export async function notifyUser(input: {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  image?: string;
  data?: Record<string, unknown>;
  channels?: ('app' | 'email' | 'sms' | 'push')[];
}) {
  const channels = input.channels || ['app'];
  const notification = new Notification({
    user: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link,
    image: input.image,
    data: input.data,
    channels,
    sentVia: {
      app: true,
      email: channels.includes('email'),
      sms: channels.includes('sms'),
      push: channels.includes('push'),
    },
  });
  await notification.save();
  return notification;
}