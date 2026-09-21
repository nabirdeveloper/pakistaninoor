import mongoose, { Schema, Document, Model } from 'mongoose';

export type CouponType = 'percentage' | 'fixed' | 'free_shipping' | 'bogo' | 'first_order';

export interface ICouponUsage {
  user: mongoose.Types.ObjectId;
  order: mongoose.Types.ObjectId;
  discountAmount: number;
  usedAt: Date;
}

export interface ICoupon extends Document {
  code: string;
  name: string;
  description?: string;
  /** Optional marketing campaign name this coupon belongs to (admin grouping). */
  campaign?: string;
  type: CouponType;
  value: number; // Percentage or fixed amount
  minOrderAmount?: number;
  maxDiscountAmount?: number;

  // BOGO specific
  buyQuantity?: number;
  getQuantity?: number;
  bogoProductIds?: mongoose.Types.ObjectId[];

  // Restrictions
  applicableCategories?: mongoose.Types.ObjectId[];
  applicableProducts?: mongoose.Types.ObjectId[];
  excludedCategories?: mongoose.Types.ObjectId[];
  excludedProducts?: mongoose.Types.ObjectId[];

  // Limits
  usageLimit?: number;
  usageLimitPerUser: number;
  usedCount: number;

  // User restrictions
  onlyForNewUsers: boolean;
  allowedUsers?: mongoose.Types.ObjectId[];

  // Dates
  startDate: Date;
  endDate?: Date;

  // Status
  isActive: boolean;

  // Usage history
  usage: ICouponUsage[];

  createdAt: Date;
  updatedAt: Date;
}

const UsageSchema = new Schema<ICouponUsage>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  discountAmount: { type: Number, required: true },
  usedAt: { type: Date, default: Date.now },
});

const CouponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Coupon name is required'],
      trim: true,
    },
    description: String,
    /** Optional marketing campaign name this coupon belongs to (admin grouping). */
    campaign: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed', 'free_shipping', 'bogo', 'first_order'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },

    // BOGO
    buyQuantity: Number,
    getQuantity: Number,
    bogoProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],

    // Restrictions
    applicableCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    applicableProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    excludedCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    excludedProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],

    // Limits
    usageLimit: Number,
    usageLimitPerUser: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },

    // User restrictions
    onlyForNewUsers: { type: Boolean, default: false },
    allowedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // Dates
    startDate: { type: Date, required: true, default: Date.now },
    endDate: Date,

    // Status
    isActive: { type: Boolean, default: true },

    // Usage
    usage: [UsageSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// Note: code is unique: true on the schema, which already creates its index
CouponSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
CouponSchema.index({ type: 1 });

// Virtual: Is valid
CouponSchema.virtual('isValid').get(function () {
  const now = new Date();
  const notExpired = !this.endDate || this.endDate > now;
  const hasStarted = this.startDate <= now;
  const hasUsagesLeft = !this.usageLimit || this.usedCount < this.usageLimit;

  return this.isActive && hasStarted && notExpired && hasUsagesLeft;
});

// Virtual: Remaining uses
CouponSchema.virtual('remainingUses').get(function () {
  if (!this.usageLimit) return Infinity;
  return Math.max(0, this.usageLimit - this.usedCount);
});

// Static: Validate coupon for order
CouponSchema.statics.validateForOrder = async function (
  code: string,
  userId: string | undefined,
  orderTotal: number,
  items: any[]
) {
  const coupon = await this.findOne({ code: code.toUpperCase() });

  if (!coupon) {
    return { valid: false, error: 'Coupon not found' };
  }

  if (!coupon.isValid) {
    return { valid: false, error: 'Coupon is not valid' };
  }

  if (coupon.minOrderAmount && orderTotal < coupon.minOrderAmount) {
    return {
      valid: false,
      error: `Minimum order amount of ৳${coupon.minOrderAmount} required`,
    };
  }

  if (userId) {
    const userUsageCount = coupon.usage.filter(
      (u: ICouponUsage) => u.user.toString() === userId
    ).length;

    if (userUsageCount >= coupon.usageLimitPerUser) {
      return { valid: false, error: 'You have already used this coupon' };
    }

    if (coupon.onlyForNewUsers) {
      const User = mongoose.model('User');
      const user = await User.findById(userId);
      if (user && user.totalOrders > 0) {
        return { valid: false, error: 'This coupon is only for new customers' };
      }
    }

    if (coupon.allowedUsers?.length > 0) {
      if (!coupon.allowedUsers.some((u: mongoose.Types.ObjectId) => u.toString() === userId)) {
        return { valid: false, error: 'You are not eligible for this coupon' };
      }
    }
  }

  return { valid: true, coupon };
};

// Method: Calculate discount
CouponSchema.methods.calculateDiscount = function (orderTotal: number, items: any[]) {
  let discount = 0;

  switch (this.type) {
    case 'percentage':
      discount = (orderTotal * this.value) / 100;
      break;
    case 'fixed':
      discount = this.value;
      break;
    case 'free_shipping':
      discount = 0; // Handled separately
      break;
    case 'bogo':
      // Calculate BOGO discount based on items
      break;
    case 'first_order':
      discount = (orderTotal * this.value) / 100;
      break;
  }

  if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
    discount = this.maxDiscountAmount;
  }

  return Math.min(discount, orderTotal);
};

const Coupon: Model<ICoupon> = mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', CouponSchema);

export default Coupon;
