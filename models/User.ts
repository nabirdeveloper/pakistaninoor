import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAddress {
  _id?: string;
  label: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  district: string;
  division: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface INotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  orderUpdates: boolean;
  promotions: boolean;
  newsletter: boolean;
}

export type PriceTier = 'budget' | 'mid' | 'premium' | 'unknown';

/**
 * Persistent AI taste profile (Phase 1 — Personalization Hub).
 * Captures the user's learned category/tag affinities, price tier and
 * engagement so the storefront can personalize shelves from real history
 * instead of transient request-time signals.
 */
export interface IAiProfile {
  /** Affinity scores keyed by category NAME (purchase=3, wishlist/cart=2, view=1). */
  categoryAffinity: Map<string, number>;
  /** Affinity scores keyed by tag name (same weights). */
  tagAffinity: Map<string, number>;
  priceTier: PriceTier;
  /** 0..100 — how much behavioral signal we have for this shopper. */
  engagementScore: number;
  /** Top category ids (derived from categoryAffinity). */
  preferredCategories: string[];
  /** Top tags (derived from tagAffinity). */
  preferredTags: string[];
  /** Recent product ids with signals (views/wishlist/cart). */
  viewedProductIds: mongoose.Types.ObjectId[];
  /** Product ids from completed orders (most recent first). */
  purchasedProductIds: mongoose.Types.ObjectId[];
  lastSignalsAt?: Date;
  updatedAt?: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;
  avatar?: string;
  role: 'user' | 'admin' | 'superadmin';
  isVerified: boolean;
  isActive: boolean;
  addresses: IAddress[];
  wishlist: mongoose.Types.ObjectId[];
  recentlyViewed: mongoose.Types.ObjectId[];
  notificationPreferences: INotificationPreferences;
  loyaltyPoints: number;
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;
  totalOrders: number;
  totalSpent: number;
  lastLogin?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  aiProfile?: IAiProfile;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateReferralCode(): string;
}

const AddressSchema = new Schema<IAddress>({
  label: { type: String, required: true, default: 'Home' },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  district: { type: String, required: true },
  division: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, default: 'Bangladesh' },
  isDefault: { type: Boolean, default: false },
});

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      match: [/^(\+88)?01[3-9]\d{8}$/, 'Please enter a valid Bangladeshi phone number'],
    },
    avatar: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin'],
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    addresses: [AddressSchema],
    wishlist: [{
      type: Schema.Types.ObjectId,
      ref: 'Product',
    }],
    recentlyViewed: [{
      type: Schema.Types.ObjectId,
      ref: 'Product',
    }],
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      orderUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      newsletter: { type: Boolean, default: false },
    },
    loyaltyPoints: {
      type: Number,
      default: 0,
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    lastLogin: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    aiProfile: {
      categoryAffinity: { type: Map, of: Number, default: {} },
      tagAffinity: { type: Map, of: Number, default: {} },
      priceTier: {
        type: String,
        enum: ['budget', 'mid', 'premium', 'unknown'],
        default: 'unknown',
      },
      engagementScore: { type: Number, default: 0, min: 0, max: 100 },
      preferredCategories: { type: [String], default: [] },
      preferredTags: { type: [String], default: [] },
      viewedProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
      purchasedProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
      lastSignalsAt: Date,
      updatedAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
// Note: email and referralCode already have unique: true which creates indexes
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Generate referral code before saving
UserSchema.pre('save', function () {
  if (!this.referralCode) {
    // Inline referral code generation to avoid method call issues
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'NOOR';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.referralCode = code;
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate referral code
UserSchema.methods.generateReferralCode = function (): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'NOOR';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Virtual for full address
// NOTE: `addresses` may be absent when the User was loaded through a scoped
// projection (e.g. populate('user', 'name email phone')). The schema enables
// toJSON virtuals, so a partially-populated doc would otherwise throw here.
UserSchema.virtual('defaultAddress').get(function () {
  return this.addresses?.find((addr) => addr.isDefault) || this.addresses?.[0] || null;
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
