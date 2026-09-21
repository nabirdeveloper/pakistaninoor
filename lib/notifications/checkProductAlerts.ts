import mongoose from 'mongoose';
import ProductAlert from '@/models/ProductAlert';
import { notifyUser } from '@/lib/notifications/push';

/**
 * Product alert triggers (Phase 4).
 *
 * Called after a product is updated (admin edit). Compares the previous
 * snapshot with the new values and fires in-app notifications to customers who
 * subscribed to back-in-stock or price-drop alerts for that product. Each alert
 * fires once (subsequent restocks / drops require a fresh subscription).
 */

interface ProductSnapshot {
  stock: number;
  price: number;
  compareAtPrice?: number;
}

interface CurrentProduct {
  _id: mongoose.Types.ObjectId | string;
  name: string;
  slug: string;
  images?: Array<{ url: string; isPrimary?: boolean }>;
  stock: number;
  price: number;
  compareAtPrice?: number;
}

export async function checkProductAlerts(prev: ProductSnapshot, product: CurrentProduct) {
  const productId = String(product._id);
  const primaryImage =
    product.images?.find((img) => img.isPrimary)?.url || product.images?.[0]?.url;

  const backInStock = prev.stock <= 0 && product.stock > 0;
  const priceDropped = product.price < prev.price;
  const wentOnSale =
    product.compareAtPrice != null &&
    product.compareAtPrice > product.price &&
    !(prev.compareAtPrice != null && prev.compareAtPrice > prev.price);

  const events: Array<{ type: 'back_in_stock' | 'price_drop'; title: string; message: string }> = [];
  if (backInStock) {
    events.push({
      type: 'back_in_stock',
      title: `${product.name} is back in stock`,
      message: `Good news — ${product.name} is available again. Grab it before it sells out!`,
    });
  }
  if (priceDropped || wentOnSale) {
    events.push({
      type: 'price_drop',
      title: `${product.name} just got cheaper`,
      message: `The price of ${product.name} is now ৳${Math.round(product.price).toLocaleString('en-IN')}. Order now to lock in the deal.`,
    });
  }

  if (events.length === 0) return;

  for (const event of events) {
    const alerts = await ProductAlert.find({
      product: productId,
      type: event.type,
      isActive: true,
      notifiedAt: null,
    }).select('user');

    if (alerts.length === 0) continue;

    const link = `/product/${product.slug}`;
    for (const alert of alerts) {
      await notifyUser({
        userId: alert.user,
        type: event.type,
        title: event.title,
        message: event.message,
        link,
        image: primaryImage,
        data: { productId, alertType: event.type },
      });
    }

    await ProductAlert.updateMany(
      { _id: { $in: alerts.map((a) => a._id) } },
      { $set: { notifiedAt: new Date() } }
    );
  }
}