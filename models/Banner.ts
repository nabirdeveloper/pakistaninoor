import mongoose, { Schema, Document, Model } from 'mongoose';

export type BannerType = 'hero' | 'promotional' | 'category' | 'sidebar' | 'popup' | 'announcement';
export type BannerPosition = 'homepage_hero' | 'homepage_middle' | 'homepage_bottom' | 'category_top' | 'product_sidebar' | 'cart_page' | 'checkout_page';

export interface IBanner extends Document {
  name: string;
  type: BannerType;
  position: BannerPosition;

  // Desktop image
  imageDesktop: string;
  imageDesktopPublicId: string;

  // Mobile image
  imageMobile?: string;
  imageMobilePublicId?: string;

  // Tablet image
  imageTablet?: string;
  imageTabletPublicId?: string;

  // Content
  title?: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonColor?: string;

  // Styling
  textColor?: string;
  textPosition?: 'left' | 'center' | 'right';
  overlayColor?: string;
  overlayOpacity?: number;

  // Countdown (for promotional banners)
  hasCountdown: boolean;
  countdownEndDate?: Date;

  // Targeting
  targetCategories?: mongoose.Types.ObjectId[];
  targetProducts?: mongoose.Types.ObjectId[];

  // Schedule
  startDate: Date;
  endDate?: Date;

  // Status
  isActive: boolean;
  sortOrder: number;

  // Analytics
  impressions: number;
  clicks: number;

  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    name: {
      type: String,
      required: [true, 'Banner name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['hero', 'promotional', 'category', 'sidebar', 'popup', 'announcement'],
      required: true,
    },
    position: {
      type: String,
      enum: ['homepage_hero', 'homepage_middle', 'homepage_bottom', 'category_top', 'product_sidebar', 'cart_page', 'checkout_page'],
      required: true,
    },

    // Images
    imageDesktop: { type: String, required: true },
    imageDesktopPublicId: { type: String, required: true },
    imageMobile: String,
    imageMobilePublicId: String,
    imageTablet: String,
    imageTabletPublicId: String,

    // Content
    title: String,
    subtitle: String,
    description: String,
    buttonText: String,
    buttonLink: String,
    buttonColor: { type: String, default: '#000000' },

    // Styling
    textColor: { type: String, default: '#ffffff' },
    textPosition: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'center',
    },
    overlayColor: { type: String, default: '#000000' },
    overlayOpacity: { type: Number, default: 0, min: 0, max: 1 },

    // Countdown
    hasCountdown: { type: Boolean, default: false },
    countdownEndDate: Date,

    // Targeting
    targetCategories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    targetProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],

    // Schedule
    startDate: { type: Date, default: Date.now },
    endDate: Date,

    // Status
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },

    // Analytics
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
BannerSchema.index({ type: 1, position: 1, isActive: 1 });
BannerSchema.index({ startDate: 1, endDate: 1 });
BannerSchema.index({ sortOrder: 1 });

// Virtual: Is currently active
BannerSchema.virtual('isCurrentlyActive').get(function () {
  const now = new Date();
  const hasStarted = this.startDate <= now;
  const notExpired = !this.endDate || this.endDate > now;
  return this.isActive && hasStarted && notExpired;
});

// Virtual: Click-through rate
BannerSchema.virtual('ctr').get(function () {
  if (this.impressions === 0) return 0;
  return ((this.clicks / this.impressions) * 100).toFixed(2);
});

// Static: Get active banners by position
BannerSchema.statics.getActiveByPosition = async function (position: BannerPosition) {
  const now = new Date();
  return this.find({
    position,
    isActive: true,
    startDate: { $lte: now },
    $or: [{ endDate: { $exists: false } }, { endDate: { $gt: now } }],
  }).sort({ sortOrder: 1 });
};

const Banner: Model<IBanner> = mongoose.models.Banner || mongoose.model<IBanner>('Banner', BannerSchema);

export default Banner;
