import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPage extends Document {
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  metaTitle?: string;
  metaDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PageSchema = new Schema<IPage>(
  {
    title: {
      type: String,
      required: [true, 'Page title is required'],
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Page content is required'],
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
    },
    metaTitle: String,
    metaDescription: String,
  },
  {
    timestamps: true,
  }
);

PageSchema.index({ slug: 1, status: 1 });

const Page: Model<IPage> =
  (mongoose.models.Page as Model<IPage>) ||
  mongoose.model<IPage>('Page', PageSchema);

export default Page;