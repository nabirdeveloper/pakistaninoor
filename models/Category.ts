import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISEOData {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
}

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  imagePublicId?: string;
  icon?: string;
  parent?: mongoose.Types.ObjectId;
  ancestors: mongoose.Types.ObjectId[];
  level: number;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  showInMenu: boolean;
  showInFooter: boolean;
  productCount: number;
  seo: ISEOData;
  createdAt: Date;
  updatedAt: Date;
}

const SEOSchema = new Schema<ISEOData>({
  metaTitle: String,
  metaDescription: String,
  metaKeywords: [String],
});

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: String,
    image: String,
    imagePublicId: String,
    icon: String,
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    ancestors: [{
      type: Schema.Types.ObjectId,
      ref: 'Category',
    }],
    level: {
      type: Number,
      default: 0,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    showInMenu: {
      type: Boolean,
      default: true,
    },
    showInFooter: {
      type: Boolean,
      default: false,
    },
    productCount: {
      type: Number,
      default: 0,
    },
    seo: SEOSchema,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// Note: slug is unique: true on the schema, which already creates its index
CategorySchema.index({ parent: 1 });
CategorySchema.index({ level: 1, sortOrder: 1 });
CategorySchema.index({ isActive: 1, showInMenu: 1 });

// Pre-save: Generate slug
CategorySchema.pre('save', async function () {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
});

// Pre-save: Set level and ancestors
CategorySchema.pre('save', async function () {
  if (this.isModified('parent')) {
    if (this.parent) {
      const parentCategory = await mongoose.model('Category').findById(this.parent);
      if (parentCategory) {
        this.level = parentCategory.level + 1;
        this.ancestors = [...parentCategory.ancestors, this.parent];
      }
    } else {
      this.level = 0;
      this.ancestors = [];
    }
  }
});

// Virtual: Children
CategorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
});

// Virtual: Full path
CategorySchema.virtual('path').get(function () {
  return `/${this.slug}`;
});

const Category: Model<ICategory> = mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);

export default Category;
