import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVariant {
  _id?: string;
  sku: string;
  name: string;
  attributes: Map<string, string>; // e.g., { color: 'Red', size: 'XL' }
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  stock: number;
  lowStockThreshold: number;
  images: string[];
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  isActive: boolean;
}

export interface IProductImage {
  url: string;
  publicId: string;
  alt?: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface IProductVideo {
  url: string;
  thumbnail?: string;
  title?: string;
}

export interface IProductReview {
  _id?: string;
  user: mongoose.Types.ObjectId;
  rating: number;
  title?: string;
  comment: string;
  images?: string[];
  isVerifiedPurchase: boolean;
  isApproved: boolean;
  helpfulCount: number;
  createdAt: Date;
  /** AI review-intelligence verdict captured at submission time (Phase 7) */
  moderation?: {
    sentiment: 'positive' | 'neutral' | 'negative';
    toxicity_score: number;
    flags: string[];
    recommendedAction: 'approve' | 'review' | 'flag';
    analyzedAt: Date;
  };
  /** Seller reply (Phase 2 – admin drafts with AI, edits, then publishes) */
  reply?: string;
  repliedBy?: mongoose.Types.ObjectId;
  repliedAt?: Date;
}

export interface IProductQuestion {
  _id?: string;
  user: mongoose.Types.ObjectId;
  question: string;
  answer?: string;
  answeredBy?: mongoose.Types.ObjectId;
  answeredAt?: Date;
  isPublic: boolean;
  createdAt: Date;
}

export interface ISEOData {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  canonicalUrl?: string;
  ogImage?: string;
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  brand?: string;
  category: mongoose.Types.ObjectId;
  subcategory?: mongoose.Types.ObjectId;
  tags: string[];

  // Pricing
  price: number;
  compareAtPrice?: number;
  costPrice?: number;

  // Stock
  sku: string;
  barcode?: string;
  stock: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;

  // Variants
  hasVariants: boolean;
  variantOptions: Map<string, string[]>; // e.g., { color: ['Red', 'Blue'], size: ['S', 'M', 'L'] }
  variants: IVariant[];

  // Media
  images: IProductImage[];
  videos: IProductVideo[];
  has360View: boolean;
  images360?: string[];

  // Status & Visibility
  status: 'draft' | 'active' | 'archived';
  visibility: 'visible' | 'hidden' | 'catalog' | 'search';
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isOnSale: boolean;

  // Badges
  badges: string[];

  // Physical properties
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };

  // Reviews & Ratings
  reviews: IProductReview[];
  averageRating: number;
  totalReviews: number;

  // Q&A
  questions: IProductQuestion[];

  // SEO
  seo: ISEOData;

  // Related products
  relatedProducts: mongoose.Types.ObjectId[];
  frequentlyBoughtWith: mongoose.Types.ObjectId[];
  upsellProducts: mongoose.Types.ObjectId[];
  crossSellProducts: mongoose.Types.ObjectId[];

  // Pre-order
  isPreOrder: boolean;
  preOrderDate?: Date;
  preOrderMessage?: string;

  // AI Generated
  aiDescription?: string;
  aiTags?: string[];

  // Stats
  viewCount: number;
  salesCount: number;
  wishlistCount: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

const VariantSchema = new Schema<IVariant>({
  sku: { type: String, required: true },
  name: { type: String, required: true },
  attributes: { type: Map, of: String },
  price: { type: Number, required: true, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  costPrice: { type: Number, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  lowStockThreshold: { type: Number, default: 5 },
  images: [String],
  weight: Number,
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
  },
  isActive: { type: Boolean, default: true },
});

const ProductImageSchema = new Schema<IProductImage>({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  alt: String,
  isPrimary: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
});

const ProductVideoSchema = new Schema<IProductVideo>({
  url: { type: String, required: true },
  thumbnail: String,
  title: String,
});

const ReviewSchema = new Schema<IProductReview>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: String,
  comment: { type: String, required: true },
  images: [String],
  isVerifiedPurchase: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  helpfulCount: { type: Number, default: 0 },
  moderation: {
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
    },
    toxicity_score: { type: Number, default: 0 },
    flags: { type: [String], default: [] },
    recommendedAction: {
      type: String,
      enum: ['approve', 'review', 'flag'],
      default: 'approve',
    },
    analyzedAt: Date,
  },
  reply: String,
  repliedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  repliedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

const QuestionSchema = new Schema<IProductQuestion>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: String, required: true },
  answer: String,
  answeredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  answeredAt: Date,
  isPublic: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const SEOSchema = new Schema<ISEOData>({
  metaTitle: String,
  metaDescription: String,
  metaKeywords: [String],
  canonicalUrl: String,
  ogImage: String,
});

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
    },
    shortDescription: String,
    brand: String,
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
    },
    tags: [{ type: String, lowercase: true }],

    // Pricing
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    compareAtPrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0 },

    // Stock
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
    },
    barcode: String,
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    trackInventory: { type: Boolean, default: true },
    allowBackorder: { type: Boolean, default: false },

    // Variants
    hasVariants: { type: Boolean, default: false },
    variantOptions: { type: Map, of: [String] },
    variants: [VariantSchema],

    // Media
    images: [ProductImageSchema],
    videos: [ProductVideoSchema],
    has360View: { type: Boolean, default: false },
    images360: [String],

    // Status & Visibility
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
    },
    visibility: {
      type: String,
      enum: ['visible', 'hidden', 'catalog', 'search'],
      default: 'visible',
    },
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    isOnSale: { type: Boolean, default: false },

    // Badges
    badges: [{ type: String }],

    // Physical properties
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },

    // Reviews
    reviews: [ReviewSchema],
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },

    // Q&A
    questions: [QuestionSchema],

    // SEO
    seo: SEOSchema,

    // Related products
    relatedProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    frequentlyBoughtWith: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    upsellProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    crossSellProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],

    // Pre-order
    isPreOrder: { type: Boolean, default: false },
    preOrderDate: Date,
    preOrderMessage: String,

    // AI Generated
    aiDescription: String,
    aiTags: [String],

    // Stats
    viewCount: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },
    wishlistCount: { type: Number, default: 0 },

    publishedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// Note: slug and sku are unique: true on the schema, which already creates their indexes
ProductSchema.index({ category: 1, status: 1 });
ProductSchema.index({ status: 1, visibility: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ averageRating: -1 });
ProductSchema.index({ salesCount: -1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
ProductSchema.index({ isFeatured: 1, status: 1 });
ProductSchema.index({ isNewArrival: 1, status: 1 });
ProductSchema.index({ isBestSeller: 1, status: 1 });

// Pre-save: Generate slug
ProductSchema.pre('save', async function () {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
});

// Pre-save: Calculate average rating
ProductSchema.pre('save', async function () {
  if (this.reviews && this.reviews.length > 0) {
    const approvedReviews = this.reviews.filter((r) => r.isApproved);
    if (approvedReviews.length > 0) {
      const sum = approvedReviews.reduce((acc, r) => acc + r.rating, 0);
      this.averageRating = Math.round((sum / approvedReviews.length) * 10) / 10;
      this.totalReviews = approvedReviews.length;
    }
  }
});

// Virtual: Primary image
ProductSchema.virtual('primaryImage').get(function () {
  const primary = this.images.find((img) => img.isPrimary);
  return primary || this.images[0];
});

// Virtual: Is in stock
ProductSchema.virtual('inStock').get(function () {
  if (this.hasVariants) {
    return this.variants.some((v) => v.stock > 0);
  }
  return this.stock > 0;
});

// Virtual: Discount percentage
ProductSchema.virtual('discountPercentage').get(function () {
  if (this.compareAtPrice && this.compareAtPrice > this.price) {
    return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
  }
  return 0;
});

// Virtual: Total stock (including variants)
ProductSchema.virtual('totalStock').get(function () {
  if (this.hasVariants) {
    return this.variants.reduce((sum, v) => sum + v.stock, 0);
  }
  return this.stock;
});

const Product: Model<IProduct> = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default Product;
