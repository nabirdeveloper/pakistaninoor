import mongoose, { Schema, Document, Model } from 'mongoose';

export type ProductAlertType = 'back_in_stock' | 'price_drop';

export interface IProductAlert extends Document {
  user: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  type: ProductAlertType;
  /** For price_drop: only notify when the price falls to/below this amount */
  targetPrice?: number;
  isActive: boolean;
  /** Set when the alert has been fired (user already notified once) */
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProductAlertSchema = new Schema<IProductAlert>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    type: {
      type: String,
      enum: ['back_in_stock', 'price_drop'],
      required: true,
    },
    targetPrice: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
    notifiedAt: Date,
  },
  { timestamps: true }
);

// One subscription per user + product + type
ProductAlertSchema.index({ user: 1, product: 1, type: 1 }, { unique: true });
ProductAlertSchema.index({ product: 1, type: 1, isActive: 1 });

const ProductAlert: Model<IProductAlert> =
  mongoose.models.ProductAlert || mongoose.model<IProductAlert>('ProductAlert', ProductAlertSchema);

export default ProductAlert;