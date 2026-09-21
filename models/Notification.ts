import mongoose, { Schema, Document, Model } from 'mongoose';

export type NotificationType =
  | 'order_placed'
  | 'order_confirmed'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'payment_received'
  | 'payment_failed'
  | 'refund_processed'
  | 'review_approved'
  | 'review_replied'
  | 'price_drop'
  | 'back_in_stock'
  | 'promotion'
  | 'loyalty_points'
  | 'referral_bonus'
  | 'account_update'
  | 'abandoned_cart'
  | 'system';

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  image?: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  channels: ('app' | 'email' | 'sms' | 'push')[];
  sentVia: {
    app: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'order_placed',
        'order_confirmed',
        'order_shipped',
        'order_delivered',
        'order_cancelled',
        'payment_received',
        'payment_failed',
        'refund_processed',
        'review_approved',
        'review_replied',
        'price_drop',
        'back_in_stock',
        'promotion',
        'loyalty_points',
        'referral_bonus',
        'account_update',
        'abandoned_cart',
        'system',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    link: String,
    image: String,
    data: Schema.Types.Mixed,
    isRead: { type: Boolean, default: false },
    readAt: Date,
    channels: [{
      type: String,
      enum: ['app', 'email', 'sms', 'push'],
    }],
    sentVia: {
      app: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
NotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, type: 1 });
NotificationSchema.index({ createdAt: -1 });

// TTL index - auto delete after 90 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Static: Get unread count
NotificationSchema.statics.getUnreadCount = async function (userId: string) {
  return this.countDocuments({ user: userId, isRead: false });
};

// Static: Mark all as read
NotificationSchema.statics.markAllAsRead = async function (userId: string) {
  return this.updateMany(
    { user: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

// Static: Create notification
NotificationSchema.statics.createNotification = async function (data: {
  user: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  image?: string;
  data?: Record<string, any>;
  channels?: ('app' | 'email' | 'sms' | 'push')[];
}) {
  const notification = new this({
    ...data,
    channels: data.channels || ['app'],
    sentVia: {
      app: true,
      email: data.channels?.includes('email') || false,
      sms: data.channels?.includes('sms') || false,
      push: data.channels?.includes('push') || false,
    },
  });

  await notification.save();
  return notification;
};

const Notification: Model<INotification> = mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
