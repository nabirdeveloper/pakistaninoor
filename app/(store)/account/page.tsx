'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Package,
  Heart,
  MapPin,
  Gift,
  TrendingUp,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  ArrowRight,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import RecommendationShelf from '@/components/store/RecommendationShelf';
import TasteProfileCard from '@/components/store/TasteProfileCard';

interface DashboardStats {
  totalOrders: number;
  totalSpent: number;
  wishlistCount: number;
  addressCount: number;
  loyaltyPoints: number;
  recentOrders: Array<{
    _id: string;
    orderNumber: string;
    total: number;
    status: string;
    createdAt: string;
    items: Array<{ name: string; image: string }>;
  }>;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'text-yellow-500 bg-yellow-50' },
  confirmed: { label: 'Confirmed', icon: CheckCircle, color: 'text-blue-500 bg-blue-50' },
  processing: { label: 'Processing', icon: Package, color: 'text-purple-500 bg-purple-50' },
  shipped: { label: 'Shipped', icon: Truck, color: 'text-indigo-500 bg-indigo-50' },
  delivered: { label: 'Delivered', icon: CheckCircle, color: 'text-green-500 bg-green-50' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-500 bg-red-50' },
};

export default function AccountDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/user/dashboard');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Orders',
      value: stats?.totalOrders || 0,
      icon: Package,
      color: 'bg-blue-500',
      href: '/account/orders',
    },
    {
      label: 'Wishlist Items',
      value: stats?.wishlistCount || 0,
      icon: Heart,
      color: 'bg-red-500',
      href: '/account/wishlist',
    },
    {
      label: 'Saved Addresses',
      value: stats?.addressCount || 0,
      icon: MapPin,
      color: 'bg-green-500',
      href: '/account/addresses',
    },
    {
      label: 'Loyalty Points',
      value: stats?.loyaltyPoints || 0,
      icon: Gift,
      color: 'bg-purple-500',
      href: '/account/rewards',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Welcome back, {session?.user?.name}!</h1>
        <p className="text-white/80">
          Manage your orders, addresses, and account settings from your dashboard.
        </p>
        {stats && stats.totalSpent > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <span>
              Total spent: <strong>৳{stats.totalSpent.toLocaleString()}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link
              href={stat.href}
              className="block bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', stat.color)}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* AI Taste Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TasteProfileCard className="lg:col-span-1" />
        <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">Made for you</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Sparkles size={11} /> AI
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Picks based on your orders, wishlist and browsing history.
          </p>
          <RecommendationShelf mode="for-you" limit={4} aiBadge={false} />
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Orders</h2>
          <Link
            href="/account/orders"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View All
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {stats?.recentOrders && stats.recentOrders.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {stats.recentOrders.map((order) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              return (
                <Link
                  key={order._id}
                  href={`/account/orders/${order._id}`}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  {/* Order Images */}
                  <div className="flex -space-x-3">
                    {order.items.slice(0, 3).map((item, i) => (
                      <img
                        key={i}
                        src={item.image || '/images/placeholder-product.png'}
                        alt={item.name}
                        className="w-12 h-12 rounded-lg object-cover border-2 border-white dark:border-gray-800"
                      />
                    ))}
                    {order.items.length > 3 && (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-500">
                          +{order.items.length - 3}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">{order.orderNumber}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  {/* Status */}
                  <div className={cn('px-3 py-1 rounded-full text-xs font-medium', status.color)}>
                    {status.label}
                  </div>

                  {/* Total */}
                  <p className="font-medium text-gray-900 dark:text-white">
                    ৳{order.total.toLocaleString()}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No orders yet</p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Start Shopping
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/account/addresses"
          className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <MapPin className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Manage Addresses</h3>
            <p className="text-sm text-gray-500">Add or edit your delivery addresses</p>
          </div>
        </Link>

        <Link
          href="/account/settings"
          className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Gift className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">Account Settings</h3>
            <p className="text-sm text-gray-500">Update your profile and preferences</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
