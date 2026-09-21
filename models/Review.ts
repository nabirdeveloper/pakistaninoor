import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReviewImage {
  url: string;
  publicId: string;
}

export interface IReview extends Document {
  product: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  order?: mongoose.Types.ObjectId;
  rating: number;
  title?: string;
  comment: string;
  images: IReviewImage[];

  // Verification
  isVerifiedPurchase: boolean;
  isApproved: boolean;
  moderatedBy?: mongoose.Types.ObjectId;
  moderatedAt?: Date;
  moderationNote?: string;

  // Engagement
  helpfulCount: number;
  unhelpfulCount: number;
  helpfulVotes: mongoose.Types.ObjectId[];
  unhelpfulVotes: mongoose.Types.ObjectId[];

  // Reply from seller
  reply?: string;
  repliedBy?: mongoose.Types.ObjectId;
  repliedAt?: Date;

  // Status
  status: 'pending' | 'approved' | 'rejected' | 'flagged';

  createdAt: Date;
  updatedAt: Date;
}

const ReviewImageSchema = new Schema<IReviewImage>({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
});

const ReviewSchema = new Schema<IReview>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    images: [ReviewImageSchema],

    // Verification
    isVerifiedPurchase: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: Date,
    moderationNote: String,

    // Engagement
    helpfulCount: { type: Number, default: 0 },
    unhelpfulCount: { type: Number, default: 0 },
    helpfulVotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    unhelpfulVotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // Reply
    reply: String,
    repliedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    repliedAt: Date,

    // Status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'flagged'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
ReviewSchema.index({ product: 1, status: 1 });
ReviewSchema.index({ user: 1 });
ReviewSchema.index({ product: 1, rating: -1 });
ReviewSchema.index({ status: 1, createdAt: -1 });
ReviewSchema.index({ isVerifiedPurchase: 1 });

// Ensure one review per user per product
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Post-save: Update product rating
ReviewSchema.post('save', async function () {
  const Review = this.constructor as Model<IReview>;
  const Product = mongoose.model('Product');

  const stats = await Review.aggregate([
    { $match: { product: this.product, status: 'approved' } },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(this.product, {
      averageRating: Math.round(stats[0].averageRating * 10) / 10,
      totalReviews: stats[0].totalReviews,
    });
  }
});

// Virtual: Is helpful
ReviewSchema.virtual('helpfulnessRatio').get(function () {
  const total = this.helpfulCount + this.unhelpfulCount;
  if (total === 0) return 0;
  return (this.helpfulCount / total) * 100;
});

// Static: Get product review summary
ReviewSchema.statics.getProductSummary = async function (productId: string) {
  const stats = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), status: 'approved' } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  const total = stats.reduce((sum, s) => sum + s.count, 0);
  const breakdown: Record<number, { count: number; percentage: number }> = {};

  for (let i = 1; i <= 5; i++) {
    const found = stats.find((s) => s._id === i);
    breakdown[i] = {
      count: found ? found.count : 0,
      percentage: found && total > 0 ? Math.round((found.count / total) * 100) : 0,
    };
  }

  return { total, breakdown };
};

const Review: Model<IReview> = mongoose.models.Review || mongoose.model<IReview>('Review', ReviewSchema);

export default Review;
