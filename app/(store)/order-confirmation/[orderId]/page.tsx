'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Package,
  Truck,
  MapPin,
  CreditCard,
  Calendar,
  Copy,
  Check,
  ArrowRight,
  Home,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name: string;
  slug: string;
  image: string;
  price: number;
  quantity: number;
  attributes?: Record<string, string>;
}

interface Order {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    district: string;
    division: string;
    postalCode: string;
  };
  estimatedDelivery?: string;
  createdAt: string;
}

export default function OrderConfirmationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const resolvedParams = use(params);
  const { data: session } = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [resolvedParams.orderId]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${resolvedParams.orderId}`);
      const data = await response.json();
      setOrder(data.order);
    } catch (error) {
      console.error('Failed to fetch order:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyOrderNumber = () => {
    if (order) {
      navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      cod: 'Cash on Delivery',
      sslcommerz: 'SSLCommerz',
      bkash: 'bKash',
      nagad: 'Nagad',
    };
    return methods[method] || method;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto mb-4" />
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-48 mx-auto" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Package className="h-24 w-24 mx-auto text-gray-300 mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Order not found
          </h1>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            <Home className="h-5 w-5" />
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="h-14 w-14 text-green-500" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Order Confirmed!
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Thank you for your order. We'll send you a confirmation email shortly.
          </p>
        </motion.div>

        {/* Order Number */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Order Number</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {order.orderNumber}
                </span>
                <button
                  onClick={copyOrderNumber}
                  className="p-2 text-gray-400 hover:text-primary transition-colors"
                  title="Copy order number"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">
                {new Date(order.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Shipping Address */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <MapPin className="h-5 w-5 text-blue-500" />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Shipping Address</h2>
            </div>
            <div className="text-gray-600 dark:text-gray-400 space-y-1">
              <p className="font-medium text-gray-900 dark:text-white">
                {order.shippingAddress.fullName}
              </p>
              <p>{order.shippingAddress.phone}</p>
              <p>{order.shippingAddress.street}</p>
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.district}
              </p>
              <p>
                {order.shippingAddress.division} - {order.shippingAddress.postalCode}
              </p>
            </div>
          </motion.div>

          {/* Payment Method */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <CreditCard className="h-5 w-5 text-purple-500" />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Payment Method</h2>
            </div>
            <p className="text-gray-900 dark:text-white font-medium">
              {getPaymentMethodLabel(order.paymentMethod)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Status:{' '}
              <span
                className={cn(
                  'font-medium',
                  order.paymentStatus === 'paid' ? 'text-green-500' : 'text-yellow-500'
                )}
              >
                {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
              </span>
            </p>
            {order.estimatedDelivery && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Truck className="h-5 w-5" />
                  <span>Estimated Delivery: {order.estimatedDelivery}</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Order Items */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6"
        >
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
            Order Items ({order.items.length})
          </h2>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {order.items.map((item, index) => (
              <div key={index} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <img
                  src={item.image || '/images/placeholder-product.png'}
                  alt={item.name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/product/${item.slug}`}
                    className="font-medium text-gray-900 dark:text-white hover:text-primary line-clamp-2"
                  >
                    {item.name}
                  </Link>
                  {item.attributes && Object.keys(item.attributes).length > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      {Object.entries(item.attributes).map(([key, value]) => (
                        <span key={key}>
                          {key}: {value}{' '}
                        </span>
                      ))}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">Quantity: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 dark:text-white">
                    ৳{(item.price * item.quantity).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">৳{item.price.toLocaleString()} each</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Order Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-8"
        >
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Order Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900 dark:text-white">
                ৳{order.subtotal.toLocaleString()}
              </span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Discount</span>
                <span className="text-green-600">-৳{order.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Shipping</span>
              <span
                className={cn(
                  order.shippingCost === 0 ? 'text-green-600' : 'text-gray-900 dark:text-white'
                )}
              >
                {order.shippingCost === 0 ? 'FREE' : `৳${order.shippingCost.toLocaleString()}`}
              </span>
            </div>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <span className="font-semibold text-gray-900 dark:text-white">Total</span>
              <span className="font-bold text-xl text-gray-900 dark:text-white">
                ৳{order.total.toLocaleString()}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link
            href="/account/orders"
            className="flex items-center justify-center gap-2 px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Package className="h-5 w-5" />
            Track Order
          </Link>
          <Link
            href="/products"
            className="flex items-center justify-center gap-2 px-8 py-3 border border-gray-200 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ShoppingBag className="h-5 w-5" />
            Continue Shopping
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
