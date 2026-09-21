import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICartItem {
  _id?: string;
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
  addedAt: Date;
}

export interface ICart extends Document {
  user?: mongoose.Types.ObjectId;
  sessionId?: string;
  items: ICartItem[];
  couponCode?: string;
  couponDiscount: number;
  isGiftWrapped: boolean;
  giftMessage?: string;
  orderNotes?: string;
  subtotal: number;
  total: number;
  itemCount: number;
  lastActivity: Date;
  expiresAt?: Date;
  /** Phase 3 – abandoned-cart recovery: when the last recovery message was sent */
  recoverySentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>({
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
  addedAt: { type: Date, default: Date.now },
});

const CartSchema = new Schema<ICart>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    sessionId: {
      type: String,
    },
    items: [CartItemSchema],
    couponCode: String,
    couponDiscount: { type: Number, default: 0 },
    isGiftWrapped: { type: Boolean, default: false },
    giftMessage: String,
    orderNotes: String,
    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    itemCount: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now },
    recoverySentAt: Date,
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
CartSchema.index({ user: 1 }, { sparse: true });
CartSchema.index({ sessionId: 1 }, { sparse: true });
CartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
CartSchema.index({ lastActivity: -1 });

// Pre-save: Calculate totals
CartSchema.pre('save', async function () {
  this.subtotal = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  this.itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.total = this.subtotal - this.couponDiscount;
  if (this.isGiftWrapped) {
    this.total += 50; // Gift wrap cost
  }
  this.lastActivity = new Date();
});

// Virtual: Is empty
CartSchema.virtual('isEmpty').get(function () {
  return this.items.length === 0;
});

// Virtual: Total savings
CartSchema.virtual('totalSavings').get(function () {
  return this.items.reduce((sum, item) => {
    if (item.compareAtPrice && item.compareAtPrice > item.price) {
      return sum + (item.compareAtPrice - item.price) * item.quantity;
    }
    return sum;
  }, 0);
});

// Static: Find or create cart
CartSchema.statics.findOrCreate = async function (userId?: string, sessionId?: string) {
  let cart;

  if (userId) {
    cart = await this.findOne({ user: userId });
  } else if (sessionId) {
    cart = await this.findOne({ sessionId });
  }

  if (!cart) {
    cart = new this({
      user: userId || undefined,
      sessionId: userId ? undefined : sessionId,
    });
    await cart.save();
  }

  return cart;
};

// Static: Merge carts (guest to user)
CartSchema.statics.mergeCarts = async function (userId: string, sessionId: string) {
  const [userCart, guestCart] = await Promise.all([
    this.findOne({ user: userId }),
    this.findOne({ sessionId }),
  ]);

  if (!guestCart) return userCart;

  if (!userCart) {
    guestCart.user = new mongoose.Types.ObjectId(userId);
    guestCart.sessionId = undefined;
    return guestCart.save();
  }

  // Merge items
  for (const guestItem of guestCart.items) {
    const existingItem = userCart.items.find(
      (item: ICartItem) => item.sku === guestItem.sku
    );

    if (existingItem) {
      existingItem.quantity += guestItem.quantity;
    } else {
      userCart.items.push(guestItem);
    }
  }

  await Promise.all([userCart.save(), guestCart.deleteOne()]);
  return userCart;
};

const Cart: Model<ICart> = mongoose.models.Cart || mongoose.model<ICart>('Cart', CartSchema);

export default Cart;
