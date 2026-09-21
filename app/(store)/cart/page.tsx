'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  Minus,
  Plus,
  ShoppingBag,
  ArrowRight,
  Tag,
  X,
  Truck,
  Gift,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import RecommendationShelf from '@/components/store/RecommendationShelf';

interface CartItem {
  _id: string;
  product: string;
  variant?: string;
  name: string;
  slug: string;
  sku: string;
  image: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  attributes?: Record<string, string>;
}

interface Cart {
  _id: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  itemCount: number;
  couponCode?: string;
  couponDiscount: number;
  isGiftWrapped: boolean;
  giftMessage?: string;
}

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [giftWrap, setGiftWrap] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');

  const GIFT_WRAP_PRICE = 50;
  const FREE_SHIPPING_THRESHOLD = 3000;
  const SHIPPING_COST = 80;

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const response = await fetch('/api/cart');
      const data = await response.json();
      setCart(data.cart);
      if (data.cart?.couponCode) {
        setCouponCode(data.cart.couponCode);
      }
      if (data.cart?.isGiftWrapped) {
        setGiftWrap(true);
        setGiftMessage(data.cart.giftMessage || '');
      }
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    setUpdating(itemId);
    try {
      const response = await fetch('/api/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, quantity }),
      });
      const data = await response.json();
      setCart(data.cart);
      window.dispatchEvent(new CustomEvent('cart-updated'));
    } catch (error) {
      console.error('Failed to update cart:', error);
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (itemId: string) => {
    setUpdating(itemId);
    try {
      const response = await fetch(`/api/cart?itemId=${itemId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      setCart(data.cart);
      window.dispatchEvent(new CustomEvent('cart-updated'));
    } catch (error) {
      console.error('Failed to remove item:', error);
    } finally {
      setUpdating(null);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;

    setApplyingCoupon(true);
    setCouponError('');

    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCouponError(data.error);
        return;
      }

      setCart(data.cart);
    } catch (error) {
      setCouponError('Failed to apply coupon');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const removeCoupon = async () => {
    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'DELETE',
      });
      const data = await response.json();
      setCart(data.cart);
      setCouponCode('');
    } catch (error) {
      console.error('Failed to remove coupon:', error);
    }
  };

  const subtotal = cart?.subtotal || 0;
  const couponDiscount = cart?.couponDiscount || 0;
  const giftWrapCost = giftWrap ? GIFT_WRAP_PRICE : 0;
  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const total = subtotal - couponDiscount + giftWrapCost + shippingCost;
  const amountToFreeShipping = FREE_SHIPPING_THRESHOLD - subtotal;

  // Bumped whenever the cart's contents change so AI shelves re-fetch with fresh signals
  const cartSignature = cart
    ? cart.items.map((item) => `${item._id}:${item.quantity}`).join(',')
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="container mx-auto px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
            <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto">
            <ShoppingBag className="h-24 w-24 mx-auto text-gray-300 mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Your cart is empty
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Looks like you haven&apos;t added anything to your cart yet.
              Start shopping and discover amazing products!
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Start Shopping
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8">
          <Link href="/" className="text-gray-500 hover:text-primary">Home</Link>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <span className="text-gray-900 dark:text-white font-medium">Shopping Cart</span>
        </nav>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Shopping Cart ({cart.itemCount} items)
        </h1>

        {/* Free Shipping Progress */}
        {subtotal < FREE_SHIPPING_THRESHOLD && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Truck className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Add <strong>৳{amountToFreeShipping.toLocaleString()}</strong> more for FREE shipping!
              </span>
            </div>
            <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {cart.items.map((item) => (
                <motion.div
                  key={item._id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm"
                >
                  <div className="flex gap-4">
                    {/* Image */}
                    <Link href={`/product/${item.slug}`} className="flex-shrink-0">
                      <img
                        src={item.image || '/images/placeholder-product.png'}
                        alt={item.name}
                        className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-lg"
                      />
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/product/${item.slug}`}
                        className="font-medium text-gray-900 dark:text-white hover:text-primary line-clamp-2"
                      >
                        {item.name}
                      </Link>

                      {/* Attributes */}
                      {item.attributes && Object.keys(item.attributes).length > 0 && (
                        <p className="text-sm text-gray-500 mt-1">
                          {Object.entries(item.attributes).map(([key, value]) => (
                            <span key={key}>{key}: {value} </span>
                          ))}
                        </p>
                      )}

                      {/* Price */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          ৳{item.price.toLocaleString()}
                        </span>
                        {item.compareAtPrice && item.compareAtPrice > item.price && (
                          <span className="text-sm text-gray-500 line-through">
                            ৳{item.compareAtPrice.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Quantity & Remove - Mobile */}
                      <div className="flex items-center justify-between mt-4 md:hidden">
                        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg">
                          <button
                            onClick={() => updateQuantity(item._id, item.quantity - 1)}
                            disabled={updating === item._id || item.quantity <= 1}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-10 text-center text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item._id, item.quantity + 1)}
                            disabled={updating === item._id}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item._id)}
                          disabled={updating === item._id}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Quantity & Remove - Desktop */}
                    <div className="hidden md:flex items-center gap-6">
                      <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg">
                        <button
                          onClick={() => updateQuantity(item._id, item.quantity - 1)}
                          disabled={updating === item._id || item.quantity <= 1}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-12 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item._id, item.quantity + 1)}
                          disabled={updating === item._id}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="text-right min-w-[100px]">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          ৳{(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>

                      <button
                        onClick={() => removeItem(item._id)}
                        disabled={updating === item._id}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Order Summary
              </h2>

              {/* Coupon Code */}
              <div className="mb-6">
                {cart.couponCode ? (
                  <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">
                        {cart.couponCode}
                      </span>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-green-600 hover:text-green-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Coupon code"
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                      <button
                        onClick={applyCoupon}
                        disabled={applyingCoupon || !couponCode.trim()}
                        className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-sm text-red-500 mt-2">{couponError}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Gift Wrap */}
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={giftWrap}
                    onChange={(e) => setGiftWrap(e.target.checked)}
                    className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          Gift Wrap
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">৳{GIFT_WRAP_PRICE}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Add a special gift wrap to your order
                    </p>
                  </div>
                </label>
                {giftWrap && (
                  <textarea
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder="Add a gift message (optional)"
                    rows={2}
                    className="mt-3 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                  />
                )}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900 dark:text-white">৳{subtotal.toLocaleString()}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Coupon Discount</span>
                    <span className="text-green-600">-৳{couponDiscount.toLocaleString()}</span>
                  </div>
                )}
                {giftWrap && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Gift Wrap</span>
                    <span className="text-gray-900 dark:text-white">৳{giftWrapCost}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Shipping</span>
                  <span className={cn(
                    shippingCost === 0 ? 'text-green-600' : 'text-gray-900 dark:text-white'
                  )}>
                    {shippingCost === 0 ? 'FREE' : `৳${shippingCost}`}
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                  <span className="font-bold text-xl text-gray-900 dark:text-white">
                    ৳{total.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <Link
                href="/checkout"
                className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Proceed to Checkout
                <ArrowRight className="h-5 w-5" />
              </Link>

              {/* Continue Shopping */}
              <Link
                href="/products"
                className="w-full flex items-center justify-center gap-2 mt-3 py-3 text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>

        {/* AI cart shelves — refresh as the cart changes */}
        <RecommendationShelf
          mode="cross-sell"
          limit={4}
          title="Complete Your Order"
          subtitle="Often bought together with the items in your cart"
          refreshKey={cartSignature}
          className="mt-12"
        />
        <RecommendationShelf
          mode="upsell"
          limit={4}
          title="Premium Picks for You"
          subtitle="Higher-value options in the categories you're shopping"
          refreshKey={cartSignature}
          className="mt-4"
        />
      </div>
    </div>
  );
}
