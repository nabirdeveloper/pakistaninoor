import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  variant?: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  sku: string;
  image: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  attributes?: Map<string, string>;
  total: number;
}

export interface IShippingAddress {
  fullName: string;
  phone: string;
  email?: string;
  street: string;
  city: string;
  district: string;
  division: string;
  postalCode: string;
  country: string;
  landmark?: string;
}

export interface IPaymentInfo {
  method: 'cod' | 'sslcommerz' | 'bkash' | 'nagad' | 'bank_transfer';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  transactionId?: string;
  gatewayResponse?: unknown;
  paidAt?: Date;
  paidAmount?: number;
}

export interface IShippingInfo {
  method: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  shippingCost: number;
  weight?: number;
}

export interface IOrderTimeline {
  status: string;
  message: string;
  timestamp: Date;
  updatedBy?: mongoose.Types.ObjectId;
}

export interface IRefund {
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  processedBy?: mongoose.Types.ObjectId;
  processedAt?: Date;
  transactionId?: string;
  createdAt: Date;
}

export interface IOrder extends Document {
  orderNumber: string;
  user?: mongoose.Types.ObjectId;
  guestEmail?: string;
  guestPhone?: string;

  // Items
  items: IOrderItem[];

  // Addresses
  shippingAddress: IShippingAddress;
  billingAddress?: IShippingAddress;
  sameAsBilling: boolean;

  // Pricing
  subtotal: number;
  discountAmount: number;
  couponCode?: string;
  couponDiscount: number;
  taxAmount: number;
  shippingCost: number;
  giftWrapCost: number;
  total: number;

  // Payment
  payment: IPaymentInfo;

  // Shipping
  shipping: IShippingInfo;

  // Status
  status: 'pending' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned' | 'refunded';

  // Options
  isGiftWrapped: boolean;
  giftMessage?: string;
  orderNotes?: string;
  deliveryPreference?: string;

  // Refund
  refunds: IRefund[];

  // Timeline
  timeline: IOrderTimeline[];

  // Invoice
  invoiceNumber?: string;
  invoiceUrl?: string;

  // Metadata
  source: 'website' | 'mobile_app' | 'admin' | 'api';
  ipAddress?: string;
  userAgent?: string;

  // Loyalty
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;

  // AI fraud screening (Phase 5)
  fraudRisk?: {
    score: number;
    level: 'low' | 'medium' | 'high';
    factors: string[];
    recommendedAction: 'approve' | 'additional_verification' | 'manual_review';
    userVerified: boolean;
    analyzedAt: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variant: { type: Schema.Types.ObjectId },
  name: { type: String, required: true },
  slug: { type: String, required: true },
  sku: { type: String, required: true },
  image: { type: String, required: true },
  price: { type: Number, required: true },
  compareAtPrice: Number,
  quantity: { type: Number, required: true, min: 1 },
  attributes: { type: Map, of: String },
  total: { type: Number, required: true },
});

const ShippingAddressSchema = new Schema<IShippingAddress>({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  email: String,
  street: { type: String, required: true },
  city: { type: String, required: true },
  district: { type: String, required: true },
  division: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, default: 'Bangladesh' },
  landmark: String,
});

const PaymentInfoSchema = new Schema<IPaymentInfo>({
  method: {
    type: String,
    enum: ['cod', 'sslcommerz', 'bkash', 'nagad', 'bank_transfer'],
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending',
  },
  transactionId: String,
  gatewayResponse: Schema.Types.Mixed,
  paidAt: Date,
  paidAmount: Number,
});

const ShippingInfoSchema = new Schema<IShippingInfo>({
  method: { type: String, required: true },
  carrier: String,
  trackingNumber: String,
  trackingUrl: String,
  estimatedDelivery: Date,
  actualDelivery: Date,
  shippingCost: { type: Number, default: 0 },
  weight: Number,
});

const TimelineSchema = new Schema<IOrderTimeline>({
  status: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
});

const RefundSchema = new Schema<IRefund>({
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending',
  },
  processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  processedAt: Date,
  transactionId: String,
  createdAt: { type: Date, default: Date.now },
});

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    guestEmail: String,
    guestPhone: String,

    items: [OrderItemSchema],

    shippingAddress: ShippingAddressSchema,
    billingAddress: ShippingAddressSchema,
    sameAsBilling: { type: Boolean, default: true },

    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    couponCode: String,
    couponDiscount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    giftWrapCost: { type: Number, default: 0 },
    total: { type: Number, required: true },

    payment: PaymentInfoSchema,
    shipping: ShippingInfoSchema,

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'],
      default: 'pending',
    },

    isGiftWrapped: { type: Boolean, default: false },
    giftMessage: String,
    orderNotes: String,
    deliveryPreference: String,

    refunds: [RefundSchema],
    timeline: [TimelineSchema],

    invoiceNumber: String,
    invoiceUrl: String,

    source: {
      type: String,
      enum: ['website', 'mobile_app', 'admin', 'api'],
      default: 'website',
    },
    ipAddress: String,
    userAgent: String,

    loyaltyPointsEarned: { type: Number, default: 0 },
    loyaltyPointsUsed: { type: Number, default: 0 },

    fraudRisk: {
      score: { type: Number, default: 0, min: 0, max: 100 },
      level: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low',
      },
      factors: { type: [String], default: [] },
      recommendedAction: {
        type: String,
        enum: ['approve', 'additional_verification', 'manual_review'],
        default: 'approve',
      },
      userVerified: { type: Boolean, default: false },
      analyzedAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// Note: orderNumber is unique: true on the schema, which already creates its index
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ 'payment.status': 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ 'shippingAddress.phone': 1 });
OrderSchema.index({ guestEmail: 1 });
// Admin analytics: coupon usage rollups group by couponCode over a date range.
OrderSchema.index({ couponCode: 1, createdAt: -1 });
// Admin analytics: refund request rollups match on nested refund fields.
OrderSchema.index({ 'refunds.status': 1 });

// Pre-validate: Generate order number.
// Runs BEFORE validation because `orderNumber` is required — a pre('save')
// hook would run too late and validation would fail first.
OrderSchema.pre('validate', async function () {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    // Get today's order count
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const count = await mongoose.model('Order').countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const sequence = (count + 1).toString().padStart(4, '0');
    this.orderNumber = `NOOR${year}${month}${day}${sequence}`;
  }
});

// Pre-validate: Add initial timeline entry (must exist before validation)
OrderSchema.pre('validate', function () {
  if (this.isNew && this.timeline.length === 0) {
    this.timeline.push({
      status: 'pending',
      message: 'Order placed successfully',
      timestamp: new Date(),
    });
  }
});

// Virtual: Is paid
OrderSchema.virtual('isPaid').get(function () {
  return this.payment.status === 'completed';
});

// Virtual: Is cancellable
OrderSchema.virtual('isCancellable').get(function () {
  return ['pending', 'confirmed', 'processing'].includes(this.status);
});

// Virtual: Total items count
OrderSchema.virtual('totalItems').get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Virtual: Total refunded
OrderSchema.virtual('totalRefunded').get(function () {
  return this.refunds
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + r.amount, 0);
});

const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
