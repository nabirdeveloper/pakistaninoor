import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Lightweight, best-effort traffic/behaviour event feed used by the
 * admin dashboard (traffic analytics, conversion funnel, live widgets).
 *
 * Recording is fire-and-forget from storefront routes — a failure to log
 * an event must never break a page or a checkout. Events expire after
 * 180 days to keep the collection bounded.
 */
export type TrafficEventType =
  | 'page_view' // any storefront page visit
  | 'product_view' // product detail page viewed
  | 'add_to_cart' // item added to cart
  | 'checkout_start' // order attempt began (checkout submitted)
  | 'order_placed'; // order created successfully

export interface ITrafficEvent extends Document {
  type: TrafficEventType;
  /** Client session id (cart_session cookie) for anonymous visitors */
  sessionId?: string;
  userId?: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  categoryId?: mongoose.Types.ObjectId;
  path?: string;
  referrer?: string;
  /** Acquisition channel when known (search / social / direct / email …) */
  source?: string;
  createdAt: Date;
}

const TrafficEventSchema = new Schema<ITrafficEvent>(
  {
    type: {
      type: String,
      enum: ['page_view', 'product_view', 'add_to_cart', 'checkout_start', 'order_placed'],
      required: true,
      index: true,
    },
    sessionId: { type: String, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    path: String,
    referrer: String,
    source: String,
  },
  { timestamps: true }
);

// Query indexes for the dashboard aggregations.
TrafficEventSchema.index({ type: 1, createdAt: -1 });
TrafficEventSchema.index({ sessionId: 1, createdAt: -1 });
TrafficEventSchema.index({ userId: 1, createdAt: -1 });

// TTL index — keep 180 days of raw events.
TrafficEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 }
);

const TrafficEvent: Model<ITrafficEvent> =
  mongoose.models.TrafficEvent ||
  mongoose.model<ITrafficEvent>('TrafficEvent', TrafficEventSchema);

export default TrafficEvent;