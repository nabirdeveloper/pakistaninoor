'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  MapPin,
  Phone,
  Mail,
  Clock,
  CreditCard,
  User,
  FileText,
  Printer,
  MessageSquare,
  ShieldAlert,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  product: {
    _id: string;
    name: string;
    slug: string;
    images: Array<{ url: string }>;
    sku: string;
  };
  variant?: {
    name: string;
    sku: string;
  };
  quantity: number;
  price: number;
  total: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  user?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  guestEmail?: string;
  guestPhone?: string;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  billingAddress?: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  subtotal: number;
  shippingCost: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentDetails?: {
    transactionId?: string;
    paidAt?: string;
  };
  notes?: string;
  adminNotes?: string;
  timeline: Array<{
    status: string;
    note?: string;
    updatedBy?: string;
    timestamp: string;
  }>;
  trackingNumber?: string;
  courierName?: string;
  giftWrapping?: boolean;
  giftMessage?: string;
  couponCode?: string;
  loyaltyPointsUsed?: number;
  loyaltyPointsEarned?: number;
  refunds?: Array<{
    _id: string;
    amount: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    transactionId?: string;
    processedAt?: string;
    createdAt: string;
  }>;
  fraudRisk?: {
    score: number;
    level: 'low' | 'medium' | 'high';
    factors: string[];
    recommendedAction: 'approve' | 'additional_verification' | 'manual_review';
    userVerified: boolean;
    analyzedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

const statusSteps = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'processing', label: 'Processing', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = params.orderNumber as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierName, setCourierName] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundActionId, setRefundActionId] = useState('');

  useEffect(() => {
    fetchOrder();
  }, [orderNumber]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/orders/${orderNumber}`);
      const data = await response.json();
      if (data.order) {
        setOrder(data.order);
        setNewStatus(data.order.status);
        setTrackingNumber(data.order.trackingNumber || '');
        setCourierName(data.order.courierName || '');
        setAdminNotes(data.order.adminNotes || '');
      }
    } catch (error) {
      console.error('Failed to fetch order:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrder = async () => {
    try {
      setUpdating(true);
      const response = await fetch(`/api/admin/orders/${orderNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          statusNote,
          trackingNumber,
          courierName,
          adminNotes,
        }),
      });

      if (response.ok) {
        fetchOrder();
        setStatusNote('');
      }
    } catch (error) {
      console.error('Failed to update order:', error);
    } finally {
      setUpdating(false);
    }
  };

  const createRefund = async () => {
    const amount = parseFloat(refundAmount);
    if (!amount || amount <= 0) {
      alert('Enter a valid refund amount');
      return;
    }
    if (!refundReason.trim()) {
      alert('Enter a refund reason');
      return;
    }
    setRefundBusy(true);
    try {
      const response = await fetch(
        `/api/admin/orders/${orderNumber}/refunds`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, reason: refundReason }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Failed to create refund');
        return;
      }
      setRefundAmount('');
      setRefundReason('');
      fetchOrder();
    } catch (error) {
      console.error('Failed to create refund:', error);
      alert('Failed to create refund');
    } finally {
      setRefundBusy(false);
    }
  };

  const runRefundAction = async (refundId: string, action: string) => {
    setRefundActionId(`${refundId}:${action}`);
    try {
      const response = await fetch(
        `/api/admin/orders/${orderNumber}/refunds/${refundId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Failed to update refund');
        return;
      }
      fetchOrder();
    } catch (error) {
      console.error('Failed to update refund:', error);
      alert('Failed to update refund');
    } finally {
      setRefundActionId('');
    }
  };

  const getStatusIndex = (status: string) => {
    const index = statusSteps.findIndex((s) => s.key === status);
    return index >= 0 ? index : 0;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'text-yellow-600 bg-yellow-100',
      confirmed: 'text-blue-600 bg-blue-100',
      processing: 'text-indigo-600 bg-indigo-100',
      packed: 'text-purple-600 bg-purple-100',
      shipped: 'text-cyan-600 bg-cyan-100',
      delivered: 'text-green-600 bg-green-100',
      cancelled: 'text-red-600 bg-red-100',
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Order not found
        </h2>
        <p className="text-gray-500 mt-2">
          The order you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 mt-4 text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>
      </div>
    );
  }

  const currentStatusIndex = getStatusIndex(order.status);

  const refundsTotal = (order.refunds || []).reduce(
    (sum, r) =>
      r.status === 'approved' || r.status === 'completed'
        ? sum + r.amount
        : sum,
    0
  );
  const refundable = Math.max(0, order.total - refundsTotal);

  const refundStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
      approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Order {order.orderNumber}
            </h1>
            <span className={cn('px-3 py-1 rounded-full text-sm font-medium', getStatusColor(order.status))}>
              {order.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Placed on {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <Printer className="h-4 w-4" />
            Print Invoice
          </button>
        </div>
      </div>

      {/* Status Progress */}
      {order.status !== 'cancelled' && order.status !== 'returned' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Order Progress
          </h2>
          <div className="relative">
            <div className="flex justify-between">
              {statusSteps.map((step, index) => {
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;
                return (
                  <div key={step.key} className="flex flex-col items-center flex-1">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center z-10',
                        isCompleted
                          ? 'bg-primary text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                      )}
                    >
                      <step.icon className="h-5 w-5" />
                    </div>
                    <span
                      className={cn(
                        'mt-2 text-sm font-medium',
                        isCurrent
                          ? 'text-primary'
                          : isCompleted
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-400'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Progress Line */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700 -z-0">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${(currentStatusIndex / (statusSteps.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Order Items ({order.items.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {order.items.map((item, index) => (
                <div key={index} className="p-6 flex items-center gap-4">
                  <div className="h-20 w-20 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                    {item.product?.images?.[0]?.url && (
                      <img
                        src={item.product.images[0].url}
                        alt={item.product.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/products/${item.product?.slug}`}
                      className="text-sm font-medium text-gray-900 dark:text-white hover:text-primary"
                    >
                      {item.product?.name}
                    </Link>
                    {item.variant && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Variant: {item.variant.name}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      SKU: {item.variant?.sku || item.product?.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      ৳{item.price.toLocaleString()} × {item.quantity}
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      ৳{item.total.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {/* Order Summary */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                <span className="text-gray-900 dark:text-white">৳{order.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Shipping</span>
                <span className="text-gray-900 dark:text-white">৳{order.shippingCost.toLocaleString()}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Discount {order.couponCode && `(${order.couponCode})`}
                  </span>
                  <span className="text-green-600">-৳{order.discount.toLocaleString()}</span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Tax</span>
                  <span className="text-gray-900 dark:text-white">৳{order.tax.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-900 dark:text-white">Total</span>
                <span className="text-gray-900 dark:text-white">৳{order.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Order Timeline
            </h2>
            <div className="space-y-4">
              {order.timeline?.map((event, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-primary"></div>
                    {index < order.timeline.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 my-1"></div>
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {event.status.replace('_', ' ')}
                    </p>
                    {event.note && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{event.note}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(event.timestamp)}
                      {event.updatedBy && ` by ${event.updatedBy}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Update Status */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Update Order
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="packed">Packed</option>
                  <option value="shipped">Shipped</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="returned">Returned</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status Note
                </label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  rows={2}
                  placeholder="Add a note about this status update..."
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Courier Name
                </label>
                <input
                  type="text"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  placeholder="e.g., Pathao, RedX, Sundarbans"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <button
                onClick={updateOrder}
                disabled={updating}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? 'Updating...' : 'Update Order'}
              </button>
            </div>
          </div>

          {/* Refunds */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Refunds
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Refunded: ৳{refundsTotal.toLocaleString()} of ৳
              {order.total.toLocaleString()} (৳{refundable.toLocaleString()}{' '}
              remaining)
            </p>
            <div className="space-y-4">
              {/* Create refund */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Amount (৳)
                </label>
                <input
                  type="number"
                  min={0}
                  max={order.total}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={`Max ৳${refundable}`}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Reason
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={2}
                  placeholder="e.g., Damaged item, wrong size, customer request"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                />
                <button
                  onClick={createRefund}
                  disabled={refundBusy || refundable <= 0}
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {refundBusy ? 'Creating…' : 'Create Refund'}
                </button>
                {refundable <= 0 && (
                  <p className="text-xs text-gray-400">
                    Order is already fully refunded.
                  </p>
                )}
              </div>

              {/* Refund list */}
              {order.refunds && order.refunds.length > 0 && (
                <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
                  {order.refunds.map((r) => (
                    <div
                      key={r._id}
                      className="rounded-lg border border-gray-100 dark:border-gray-700 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          ৳{r.amount.toLocaleString()}
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            refundStatusColor(r.status)
                          )}
                        >
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {r.reason}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {formatDate(r.createdAt)}
                      </p>
                      {r.status === 'pending' && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => runRefundAction(r._id, 'approve')}
                            disabled={!!refundActionId}
                            className="flex-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {refundActionId === `${r._id}:approve` ? (
                              <Loader2 className="h-3 w-3 mx-auto animate-spin" />
                            ) : (
                              'Approve'
                            )}
                          </button>
                          <button
                            onClick={() => runRefundAction(r._id, 'reject')}
                            disabled={!!refundActionId}
                            className="flex-1 rounded-md border border-red-300 dark:border-red-800 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {r.status === 'approved' && (
                        <button
                          onClick={() => runRefundAction(r._id, 'complete')}
                          disabled={!!refundActionId}
                          className="mt-2 w-full rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {refundActionId === `${r._id}:complete` ? (
                            <Loader2 className="h-3 w-3 mx-auto animate-spin" />
                          ) : (
                            'Mark as Completed / Paid'
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Customer
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-900 dark:text-white">
                  {order.user?.name || order.shippingAddress.fullName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-900 dark:text-white">
                  {order.user?.email || order.guestEmail}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-900 dark:text-white">
                  {order.user?.phone || order.guestPhone || order.shippingAddress.phone}
                </span>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Shipping Address
            </h3>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="text-sm text-gray-900 dark:text-white">
                <p className="font-medium">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.address}</p>
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                  {order.shippingAddress.postalCode}
                </p>
                <p>{order.shippingAddress.country}</p>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  {order.shippingAddress.phone}
                </p>
              </div>
            </div>
          </div>

          {/* AI Fraud Screener */}
          {order.fraudRisk?.analyzedAt && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                AI Fraud Screener
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Analyzed {formatDate(order.fraudRisk.analyzedAt)} at checkout
              </p>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium capitalize text-gray-900 dark:text-white">
                      {order.fraudRisk.level} risk
                    </span>
                    <span className="text-sm text-gray-500">Score {order.fraudRisk.score}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        order.fraudRisk.level === 'high'
                          ? 'bg-red-500'
                          : order.fraudRisk.level === 'medium'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      )}
                      style={{ width: `${order.fraudRisk.score}%` }}
                    />
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
                    order.fraudRisk.recommendedAction === 'manual_review'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : order.fraudRisk.recommendedAction === 'additional_verification'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  )}
                >
                  {order.fraudRisk.recommendedAction.replace('_', ' ')}
                </span>
              </div>
              {order.fraudRisk.factors.length > 0 && (
                <ul className="space-y-1.5">
                  {order.fraudRisk.factors.map((factor) => (
                    <li
                      key={factor}
                      className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                      {factor}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                Screened by the AI fraud engine at order placement. High-risk orders are recommended for manual review before dispatch.
              </p>
            </div>
          )}

          {/* Payment Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Payment
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Method</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {order.paymentMethod.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    order.paymentStatus === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : order.paymentStatus === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  )}
                >
                  {order.paymentStatus}
                </span>
              </div>
              {order.paymentDetails?.transactionId && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Transaction ID</span>
                  <span className="text-sm font-mono text-gray-900 dark:text-white">
                    {order.paymentDetails.transactionId}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Admin Notes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Admin Notes
            </h3>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={4}
              placeholder="Add internal notes about this order..."
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-sm focus:border-primary focus:outline-none resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
