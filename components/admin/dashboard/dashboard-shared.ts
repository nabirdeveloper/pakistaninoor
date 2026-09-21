// Shared types, constants and formatters for the admin dashboard.
// Kept free of React components so both `page.tsx` (shell) and
// `dashboard-grid.tsx` (heavy chart widgets) can import them.

import type { ComponentType } from 'react';
import {
  AlertTriangle,
  BadgePercent,
  Boxes,
  Clock,
  DollarSign,
  Package,
  PackageX,
  Percent,
  Receipt,
  Repeat,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Target,
  TrendingUp,
  Undo2,
  Users,
  Wallet,
  Warehouse,
  XCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Data types (mirror of /api/admin/dashboard response)
// ---------------------------------------------------------------------------

export interface ChartRow {
  _id?: string;
  revenue?: number;
  orders?: number;
  count?: number;
  units?: number;
}

export interface ActivityItem {
  key: string;
  type: 'order' | 'customer' | 'review' | 'ticket';
  title: string;
  detail: string;
  time: string;
  href: string;
}

export interface DashboardData {
  range: { from: string; to: string; days: number };
  overview: {
    totalSales: number;
    totalOrders: number;
    totalCustomers: number;
    totalProducts: number;
    totalRevenue: number;
    netRevenue: number;
    grossProfit: number;
    averageOrderValue: number;
    conversionRate: number;
    returningCustomerRate: number;
    refundAmount: number;
    cancelledOrders: number;
    pendingOrders: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    inventoryValue: number;
    inventoryCost: number;
    inventoryUnits: number;
    couponSavings: number;
    couponOrders: number;
    pendingRefunds: number;
    pendingRefundAmount: number;
  };
  inventory: {
    units: number;
    costValue: number;
    retailValue: number;
    potentialProfit: number;
    byCategory: Array<{ name: string; units: number; retailValue: number }>;
  };
  promos: {
    couponOrders: number;
    totalDiscount: number;
    couponRevenue: number;
    byCoupon: Array<{ code: string; orders: number; discount: number; revenue: number }>;
  };
  hourly: Array<{ hour: number; orders: number; revenue: number }>;
  topCustomers: Array<{ name: string; email?: string; orders: number; spend: number }>;
  delivery: {
    avgHours: number;
    deliveredCount: number;
    inTransit: number;
    toFulfill: number;
  };
  refunds: {
    pending: { count: number; amount: number };
    byReason: Array<{ reason: string; count: number; amount: number }>;
  };
  live: {
    liveOrders: number;
    liveVisitors: number;
    liveCheckout: number;
    liveRevenue: number;
    recentActivities: ActivityItem[];
    recentOrders: Array<{
      _id: string;
      orderNumber: string;
      total: number;
      status: string;
      createdAt: string;
      user?: { name?: string; email?: string };
    }>;
    newCustomers: { count: number; recent: Array<{ _id: string; name: string; email: string; createdAt: string }> };
    supportTickets: { open: number; recent: Array<{ _id: string; ticketNumber: string; subject: string; priority: string; status: string; createdAt: string }> };
    paymentAlerts: { count: number; recent: Array<{ _id: string; orderNumber: string; total: number; method: string; city: string; createdAt: string }> };
    fraudAlerts: { count: number; recent: Array<{ _id: string; orderNumber: string; total: number; level: string; score: number; action: string; city?: string; analyzedAt: string }> };
    inventoryAlerts: Array<{ _id: string; name: string; slug: string; image?: string; stock: number; threshold: number }>;
  };
  charts: {
    revenue: ChartRow[];
    sales: ChartRow[];
    orders: ChartRow[];
    customerGrowth: ChartRow[];
    productPerformance: Array<{ _id: string; name: string; slug: string; image?: string; units: number; revenue: number }>;
    categoryPerformance: Array<{ name: string; revenue: number; units: number }>;
    traffic: Array<{ _id: string; views: number; carts: number; orders: number }>;
    trafficSources: Array<{ source: string; views: number }>;
    funnel: { visitors: number; productViews: number; addToCart: number; checkout: number; orders: number; delivered: number };
    geography: Array<{ city: string; orders: number; revenue: number }>;
    paymentMethods: Array<{ method: string; orders: number; revenue: number }>;
    prevRevenue: ChartRow[];
  };
  ordersByStatus: Record<string, number>;
  comparison: {
    prevOrders: number;
    prevRevenue: number;
    prevUnits: number;
    prevCustomers: number;
    prevVisitors: number;
  };
  heatmap: Array<{ weekday: number; hour: number; orders: number; revenue: number }>;
}

export interface AiInsights {
  source: string;
  health_score: number;
  insights: string[];
  suggestions: string[];
  forecast?: Array<{ date: string; revenue: number }>;
}

// ---------------------------------------------------------------------------
// Currency / formatting helpers
// ---------------------------------------------------------------------------

export type CurrencyCode = 'BDT' | 'USD' | 'PKR' | 'INR' | 'EUR' | 'GBP';

export const CURRENCIES: Record<CurrencyCode, { symbol: string; rate: number; decimals: number }> = {
  BDT: { symbol: '৳', rate: 1, decimals: 0 },
  USD: { symbol: '$', rate: 0.0085, decimals: 2 },
  PKR: { symbol: '₨', rate: 2.35, decimals: 0 },
  INR: { symbol: '₹', rate: 0.71, decimals: 0 },
  EUR: { symbol: '€', rate: 0.0078, decimals: 2 },
  GBP: { symbol: '£', rate: 0.0067, decimals: 2 },
};

export function timeAgo(iso?: string | Date): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const shortDate = (d?: string | Date) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

export const fmtDuration = (hours: number) => {
  if (!hours || hours <= 0) return '—';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
};

// ---------------------------------------------------------------------------
// Widget registry
// ---------------------------------------------------------------------------

export type WidgetId =
  | 'overview'
  | 'live'
  | 'revenue'
  | 'sales'
  | 'orders'
  | 'customers'
  | 'products'
  | 'categories'
  | 'traffic'
  | 'funnel'
  | 'geography'
  | 'payments'
  | 'recentOrders'
  | 'activities'
  | 'newCustomers'
  | 'tickets'
  | 'alerts'
  | 'ai'
  | 'inventory'
  | 'promos'
  | 'hourly'
  | 'topCustomers'
  | 'delivery'
  | 'refunds'
  | 'compare'
  | 'heatmap'
  | 'radar'
  | 'gauges';

export const ALL_WIDGETS: WidgetId[] = [
  'overview',
  'live',
  'revenue',
  'sales',
  'orders',
  'customers',
  'traffic',
  'payments',
  'funnel',
  'geography',
  'recentOrders',
  'activities',
  'newCustomers',
  'tickets',
  'alerts',
  'ai',
  'inventory',
  'promos',
  'hourly',
  'topCustomers',
  'delivery',
  'refunds',
  'compare',
  'heatmap',
  'radar',
  'gauges',
  'products',
  'categories',
];

export const WIDGET_META: Record<WidgetId, { title: string; description: string; span: string }> = {
  // Wide, "hero" widgets span the full (6-col) grid.
  overview: { title: 'Overview', description: 'Headline store metrics', span: 'xl:col-span-6' },
  live: { title: 'Live Pulse', description: 'Real-time store activity', span: 'xl:col-span-6' },
  alerts: { title: 'Alerts', description: 'Payment, fraud & inventory', span: 'xl:col-span-6' },
  ai: { title: 'AI Insights', description: 'Machine-generated analysis', span: 'xl:col-span-6' },
  // Primary analytics take 2/3 width; their compact companions take 1/3.
  revenue: { title: 'Revenue Analytics', description: 'Daily revenue & volume', span: 'xl:col-span-4' },
  sales: { title: 'Sales Analytics', description: 'Units sold per day', span: 'xl:col-span-2' },
  traffic: { title: 'Traffic Analytics', description: 'Page views, carts & orders', span: 'xl:col-span-4' },
  payments: { title: 'Payment Methods', description: 'Orders & revenue by gateway', span: 'xl:col-span-2' },
  // Balanced pairs (half the grid each).
  orders: { title: 'Order Analytics', description: 'Orders per day', span: 'xl:col-span-3' },
  customers: { title: 'Customer Growth', description: 'New customers per day', span: 'xl:col-span-3' },
  funnel: { title: 'Conversion Funnel', description: 'Visitor → delivered journey', span: 'xl:col-span-3' },
  geography: { title: 'Geographic Sales', description: 'Top delivery cities', span: 'xl:col-span-3' },
  recentOrders: { title: 'Recent Orders', description: 'Latest orders', span: 'xl:col-span-3' },
  activities: { title: 'Recent Activity', description: 'Live events feed', span: 'xl:col-span-3' },
  newCustomers: { title: 'New Customers', description: 'Latest signups', span: 'xl:col-span-3' },
  tickets: { title: 'Support Tickets', description: 'Open support queue', span: 'xl:col-span-3' },
  inventory: { title: 'Inventory Snapshot', description: 'Stock value & health', span: 'xl:col-span-3' },
  promos: { title: 'Promotions', description: 'Coupon & discount performance', span: 'xl:col-span-3' },
  hourly: { title: 'Peak Hours', description: 'Orders by time of day', span: 'xl:col-span-3' },
  topCustomers: { title: 'Top Customers', description: 'Highest spenders', span: 'xl:col-span-3' },
  delivery: { title: 'Delivery Performance', description: 'Fulfillment & shipping', span: 'xl:col-span-3' },
  refunds: { title: 'Refunds & Returns', description: 'Pending requests & reasons', span: 'xl:col-span-3' },
  products: { title: 'Product Performance', description: 'Top sellers by revenue', span: 'xl:col-span-3' },
  categories: { title: 'Category Performance', description: 'Revenue by category', span: 'xl:col-span-3' },
  compare: { title: 'Performance Explorer', description: 'Revenue, orders, units & AOV with brush zoom + prev-period compare', span: 'xl:col-span-6' },
  heatmap: { title: 'Activity Heatmap', description: 'Orders & revenue by weekday × hour', span: 'xl:col-span-3' },
  radar: { title: 'Category Balance', description: 'Revenue & units across categories', span: 'xl:col-span-3' },
  gauges: { title: 'Health Gauges', description: 'Conversion, retention, fulfillment & stock health', span: 'xl:col-span-3' },
};

// ---------------------------------------------------------------------------
// KPI registry
// ---------------------------------------------------------------------------

export type OverviewKey =
  | 'totalSales'
  | 'totalOrders'
  | 'totalCustomers'
  | 'totalProducts'
  | 'totalRevenue'
  | 'netRevenue'
  | 'grossProfit'
  | 'averageOrderValue'
  | 'conversionRate'
  | 'returningCustomerRate'
  | 'refundAmount'
  | 'cancelledOrders'
  | 'pendingOrders'
  | 'lowStockProducts'
  | 'outOfStockProducts'
  | 'inventoryValue'
  | 'inventoryCost'
  | 'inventoryUnits'
  | 'couponSavings'
  | 'couponOrders'
  | 'pendingRefunds'
  | 'pendingRefundAmount';

export interface KpiCardDef {
  key: OverviewKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  format: 'currency' | 'int' | 'pct';
  sub?: string;
  href?: string;
}

export interface KpiDelta {
  pct: number | null; // null → no previous-period baseline (brand new metric)
  prev: number;
}

export const kpiCards: KpiCardDef[] = [
  { key: 'totalSales', label: 'Total Sales', icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20', format: 'int', sub: 'units sold' },
  { key: 'totalOrders', label: 'Total Orders', icon: ShoppingCart, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/20', format: 'int' },
  { key: 'totalCustomers', label: 'Total Customers', icon: Users, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/20', format: 'int', sub: 'placed orders' },
  { key: 'totalProducts', label: 'Total Products', icon: Package, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/20', format: 'int', sub: 'active' },
  { key: 'totalRevenue', label: 'Total Revenue', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/20', format: 'currency' },
  { key: 'netRevenue', label: 'Net Revenue', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/20', format: 'currency', sub: 'after refunds' },
  { key: 'grossProfit', label: 'Gross Profit', icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/20', format: 'currency', sub: 'revenue − COGS' },
  { key: 'averageOrderValue', label: 'Avg Order Value', icon: Receipt, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/20', format: 'currency' },
  { key: 'conversionRate', label: 'Conversion Rate', icon: Target, color: 'text-fuchsia-600', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/20', format: 'pct' },
  { key: 'returningCustomerRate', label: 'Returning Customers', icon: Repeat, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/20', format: 'pct' },
  { key: 'refundAmount', label: 'Refunds', icon: RotateCcw, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/20', format: 'currency', sub: 'approved' },
  { key: 'cancelledOrders', label: 'Cancelled', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/20', format: 'int' },
  { key: 'pendingOrders', label: 'Pending', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/20', format: 'int', href: '/admin/orders?status=pending' },
  { key: 'lowStockProducts', label: 'Low Stock', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/20', format: 'int', href: '/admin/inventory' },
  { key: 'outOfStockProducts', label: 'Out of Stock', icon: PackageX, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/20', format: 'int', href: '/admin/inventory' },
  { key: 'inventoryValue', label: 'Inventory Value', icon: Boxes, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/20', format: 'currency', sub: 'retail value of stock', href: '/admin/inventory' },
  { key: 'inventoryUnits', label: 'Units in Stock', icon: Warehouse, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/20', format: 'int', sub: 'tracked inventory' },
  { key: 'couponSavings', label: 'Promo Discounts', icon: BadgePercent, color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/20', format: 'currency', sub: 'coupons applied' },
  { key: 'couponOrders', label: 'Promo Orders', icon: Percent, color: 'text-fuchsia-600', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/20', format: 'int', sub: 'orders with coupons' },
  { key: 'pendingRefunds', label: 'Refund Requests', icon: Undo2, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/20', format: 'int', sub: 'awaiting action' },
  { key: 'pendingRefundAmount', label: 'Refunds Pending', icon: RotateCcw, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/20', format: 'currency', sub: 'requested amount' },
];

// ---------------------------------------------------------------------------
// Visual palettes
// ---------------------------------------------------------------------------

export const gatewayColors: Record<string, string> = {
  bkash: '#e2136e',
  nagad: '#f6921e',
  sslcommerz: '#e4022d',
  cod: '#10b981',
  card: '#3b82f6',
  bank: '#f59e0b',
  wallet: '#8b5cf6',
  upi: '#8a2be2',
  mobile: '#14b8a6',
};

/** Hex equivalents of the KPI `text-*` classes — used for sparklines. */
export const SPARK_COLORS: Record<string, string> = {
  'text-blue-600': '#3b82f6',
  'text-indigo-600': '#6366f1',
  'text-purple-600': '#a855f7',
  'text-amber-600': '#f59e0b',
  'text-green-600': '#22c55e',
  'text-emerald-600': '#10b981',
  'text-teal-600': '#14b8a6',
  'text-cyan-600': '#06b6d4',
  'text-fuchsia-600': '#d946ef',
  'text-violet-600': '#8b5cf6',
  'text-rose-600': '#f43f5e',
  'text-red-600': '#ef4444',
  'text-yellow-600': '#eab308',
  'text-orange-600': '#f97316',
  'text-pink-600': '#ec4899',
};

export const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  processing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  packed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  shipped: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  out_for_delivery: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  returned: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  refunded: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
};

// ---------------------------------------------------------------------------
// Dashboard config / persistence
// ---------------------------------------------------------------------------

export const STORAGE_KEY = 'pn:dashboard:cfg';

export interface DashConfig {
  order: WidgetId[];
  disabled: Partial<Record<WidgetId | OverviewKey, boolean>>;
  currency: CurrencyCode;
  autoRefresh: boolean;
}