import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBlogComment {
  _id?: string;
  user: mongoose.Types.ObjectId;
  content: string;
  isApproved: boolean;
  createdAt: Date;
}

export interface IBlog extends Document {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage: string;
  featuredImagePublicId: string;
  author: mongoose.Types.ObjectId;
  category: string;
  tags: string[];

  // SEO
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];

  // Status
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;

  // Engagement
  viewCount: number;
  comments: IBlogComment[];
  likes: mongoose.Types.ObjectId[];
  likeCount: number;

  // Related
  relatedProducts?: mongoose.Types.ObjectId[];

  /** @added Phase 3 – flagged when the draft came from the AI Content Studio */
  aiGenerated?: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IBlogComment>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 1000 },
  isApproved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const BlogSchema = new Schema<IBlog>(
  {
    title: {
      type: String,
      required: [true, 'Blog title is required'],
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    excerpt: {
      type: String,
      required: [true, 'Excerpt is required'],
      maxlength: 500,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    featuredImage: { type: String, required: true },
    featuredImagePublicId: { type: String, required: true },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    tags: [{ type: String, lowercase: true }],

    // SEO
    metaTitle: String,
    metaDescription: String,
    metaKeywords: [String],

    // Status
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    publishedAt: Date,

    // Engagement
    viewCount: { type: Number, default: 0 },
    comments: [CommentSchema],
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    likeCount: { type: Number, default: 0 },

    // Related
    relatedProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],

    // AI Content Studio (Phase 3)
    aiGenerated: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// Note: slug is unique: true on the schema, which already creates its index
BlogSchema.index({ status: 1, publishedAt: -1 });
BlogSchema.index({ category: 1, status: 1 });
BlogSchema.index({ tags: 1 });
BlogSchema.index({ title: 'text', content: 'text', tags: 'text' });

// Pre-save: Generate slug
BlogSchema.pre('save', async function () {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

// Virtual: Approved comments count
BlogSchema.virtual('approvedCommentsCount').get(function () {
  return this.comments.filter((c) => c.isApproved).length;
});

// Virtual: Reading time (assuming 200 words per minute)
BlogSchema.virtual('readingTime').get(function () {
  const wordCount = this.content.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / 200);
  return `${minutes} min read`;
});

const Blog: Model<IBlog> = mongoose.models.Blog || mongoose.model<IBlog>('Blog', BlogSchema);

export default Blog;
