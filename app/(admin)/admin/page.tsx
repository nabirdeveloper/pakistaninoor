'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  DollarSign,
  Download,
  Eye,
  GripVertical,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  Package,
  PackageX,
  RefreshCw,
  Repeat,
  RotateCcw,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  Ticket as TicketIcon,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  X,
  XCircle,
  CreditCard,
  Activity,
  Boxes,
  BadgePercent,
  CalendarClock,
  Crown,
  Truck,
  Undo2,
  Warehouse,
  Coins,
  Hourglass,
  Percent,
} from 'lucide-react';
import {
  LineChart,
  BarChart,
  DonutChart,
  FunnelChart,
  HBarList,
  EmptyChart,
  type ChartDatum,
} from '@/components/admin/dashboard/charts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChartRow {
  _id?: string;
  revenue?: number;
  orders?: number;
  count?: number;
  units?: number;
}

interface ActivityItem {
  key: string;
  type: 'order' | 'customer' | 'review' | 'ticket';
  title: string;
  detail: string;
  time: string;
  href: string;
}

interface DashboardData {
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
  };
  ordersByStatus: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Currency / formatting helpers
// ---------------------------------------------------------------------------

type CurrencyCode = 'BDT' | 'USD' | 'PKR' | 'INR' | 'EUR' | 'GBP';

const CURRENCIES: Record<CurrencyCode, { symbol: string; rate: number; decimals: number }> = {
  BDT: { symbol: '৳', rate: 1, decimals: 0 },
  USD: { symbol: '$', rate: 0.0085, decimals: 2 },
  PKR: { symbol: '₨', rate: 2.35, decimals: 0 },
  INR: { symbol: '₹', rate: 0.71, decimals: 0 },
  EUR: { symbol: '€', rate: 0.0078, decimals: 2 },
  GBP: { symbol: '£', rate: 0.0067, decimals: 2 },
};

const statusColors: Record<string, string> = {
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

function timeAgo(iso?: string | Date): string {
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

const shortDate = (d?: string | Date) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

const fmtDuration = (hours: number) => {
  if (!hours || hours <= 0) return '—';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
};

// ---------------------------------------------------------------------------
// Widget registry
// ---------------------------------------------------------------------------

type WidgetId =
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
  | 'refunds';

const ALL_WIDGETS: WidgetId[] = [
  'overview',
  'live',
  'revenue',
  'sales',
  'orders',
  'customers',
  'traffic',
  'payments',
  'products',
  'categories',
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
];

const WIDGET_META: Record<WidgetId, { title: string; description: string; span: string }> = {
  overview: { title: 'Overview', description: 'Headline store metrics', span: 'xl:col-span-2' },
  live: { title: 'Live Pulse', description: 'Real-time store activity', span: 'xl:col-span-2' },
  revenue: { title: 'Revenue Analytics', description: 'Daily revenue & volume', span: '' },
  sales: { title: 'Sales Analytics', description: 'Units sold per day', span: '' },
  orders: { title: 'Order Analytics', description: 'Orders per day', span: '' },
  customers: { title: 'Customer Growth', description: 'New customers per day', span: '' },
  products: { title: 'Product Performance', description: 'Top sellers by revenue', span: '' },
  categories: { title: 'Category Performance', description: 'Revenue by category', span: '' },
  traffic: { title: 'Traffic Analytics', description: 'Page views, carts & orders', span: '' },
  funnel: { title: 'Conversion Funnel', description: 'Visitor → delivered journey', span: '' },
  geography: { title: 'Geographic Sales', description: 'Top delivery cities', span: '' },
  payments: { title: 'Payment Methods', description: 'Orders & revenue by gateway', span: '' },
  recentOrders: { title: 'Recent Orders', description: 'Latest orders', span: '' },
  activities: { title: 'Recent Activity', description: 'Live events feed', span: '' },
  newCustomers: { title: 'New Customers', description: 'Latest signups', span: '' },
  tickets: { title: 'Support Tickets', description: 'Open support queue', span: '' },
  alerts: { title: 'Alerts', description: 'Payment, fraud & inventory', span: 'xl:col-span-2' },
  ai: { title: 'AI Insights', description: 'Machine-generated analysis', span: 'xl:col-span-2' },
  inventory: { title: 'Inventory Snapshot', description: 'Stock value & health', span: '' },
  promos: { title: 'Promotions', description: 'Coupon & discount performance', span: '' },
  hourly: { title: 'Peak Hours', description: 'Orders by time of day', span: '' },
  topCustomers: { title: 'Top Customers', description: 'Highest spenders', span: '' },
  delivery: { title: 'Delivery Performance', description: 'Fulfillment & shipping', span: '' },
  refunds: { title: 'Refunds & Returns', description: 'Pending requests & reasons', span: '' },
};

type OverviewKey =
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

const STORAGE_KEY = 'pn:dashboard:cfg';

interface DashConfig {
  order: WidgetId[];
  disabled: Partial<Record<WidgetId | OverviewKey, boolean>>;
  currency: CurrencyCode;
  autoRefresh: boolean;
}

function ToggleSwitch({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors',
        enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
      )}
      aria-label={`${enabled ? 'Disable' : 'Enable'} ${label}`}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          enabled ? 'left-[22px]' : 'left-0.5'
        )}
      />
    </button>
  );
}

function loadConfig(): DashConfig {
  if (typeof window === 'undefined') {
    return { order: ALL_WIDGETS, disabled: {}, currency: 'BDT', autoRefresh: true };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const order: WidgetId[] = Array.isArray(parsed.order)
        ? parsed.order.filter((id: string) => ALL_WIDGETS.includes(id as WidgetId))
        : ALL_WIDGETS;
      ALL_WIDGETS.forEach((id) => {
        if (!order.includes(id)) order.push(id);
      });
      return {
        order,
        disabled: parsed.disabled || {},
        currency: CURRENCIES[parsed.currency as CurrencyCode] ? parsed.currency : 'BDT',
        autoRefresh: parsed.autoRefresh !== false,
      };
    }
  } catch {
    // fall through to defaults
  }
  return { order: ALL_WIDGETS, disabled: {}, currency: 'BDT', autoRefresh: true };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [config, setConfig] = useState<DashConfig>(loadConfig);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [alertTab, setAlertTab] = useState<'payment' | 'fraud' | 'inventory'>('payment');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<string | null>(null);
  dragIdRef.current = dragId;

  const currency = CURRENCIES[config.currency];

  const fmtCurrency = useCallback(
    (n: number) =>
      `${currency.symbol}${(n * currency.rate).toLocaleString(undefined, {
        maximumFractionDigits: currency.decimals,
      })}`,
    [currency]
  );
  const fmtInt = useCallback((n: number) => n.toLocaleString(), []);
  const fmtPct = useCallback((n: number) => `${n}%`, []);

  const queryKey = useMemo(() => {
    if (period === 'custom' && customStart && customEnd) {
      return `start=${encodeURIComponent(customStart)}&end=${encodeURIComponent(customEnd)}`;
    }
    return `days=${period}`;
  }, [period, customStart, customEnd]);

  const fetchData = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      setError('');
      try {
        const [dashRes, aiRes] = await Promise.all([
          fetch(`/api/admin/dashboard?${queryKey}`, { cache: 'no-store' }),
          fetch(`/api/admin/ai-insights?period=${queryKey.includes('days') ? queryKey.split('=')[1] : '30'}`, { cache: 'no-store' }),
        ]);
        const dash = await dashRes.json();
        if (!dashRes.ok) throw new Error(dash.error || 'Failed to load dashboard');
        setData(dash);
        const ai = await aiRes.json().catch(() => null);
        if (ai && !ai.error) setAiInsights(ai);
        setLastUpdated(new Date());
      } catch (e: any) {
        setError(e.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    },
    [queryKey]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto refresh every 60s while the tab is visible
  useEffect(() => {
    if (!config.autoRefresh) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData(true);
    }, 60000);
    return () => clearInterval(t);
  }, [config.autoRefresh, fetchData]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // storage unavailable — personal dashboard simply won't persist
    }
  }, [config]);

  const toggleWidget = (id: WidgetId | OverviewKey) => {
    setConfig((prev) => {
      const disabled = { ...prev.disabled };
      if (disabled[id]) delete disabled[id];
      else disabled[id] = true;
      return { ...prev, disabled };
    });
  };

  const resetLayout = () => {
    setConfig({ order: ALL_WIDGETS, disabled: {}, currency: 'BDT', autoRefresh: true });
    setPeriod('30');
  };

  const handleDrop = (targetId: string) => {
    const from = dragIdRef.current;
    if (!from || from === targetId) return;
    setConfig((prev) => {
      const order = prev.order.filter((id) => id !== from);
      const idx = order.indexOf(targetId as WidgetId);
      order.splice(idx, 0, from as WidgetId);
      return { ...prev, order };
    });
    setDragId(null);
    setOverId(null);
  };

  // ── Export helpers ──────────────────────────────────────────────────────
  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (!data) return;
    const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines: (string | number | undefined)[][] = [
      ['Pakistan Noor — Dashboard Export'],
      [`Range`, `${new Date(data.range.from).toLocaleDateString()} — ${new Date(data.range.to).toLocaleDateString()}`],
      [`Exported at`, new Date().toLocaleString()],
      [''],
      ['Metric', 'Value'],
      ['Total Sales (units)', data.overview.totalSales],
      ['Total Orders', data.overview.totalOrders],
      ['Total Customers', data.overview.totalCustomers],
      ['Total Products', data.overview.totalProducts],
      ['Total Revenue (BDT)', data.overview.totalRevenue],
      ['Net Revenue (BDT)', data.overview.netRevenue],
      ['Gross Profit (BDT)', data.overview.grossProfit],
      ['Average Order Value (BDT)', data.overview.averageOrderValue],
      ['Conversion Rate (%)', data.overview.conversionRate],
      ['Returning Customer Rate (%)', data.overview.returningCustomerRate],
      ['Refund Amount (BDT)', data.overview.refundAmount],
      ['Cancelled Orders', data.overview.cancelledOrders],
      ['Pending Orders', data.overview.pendingOrders],
      ['Low Stock Products', data.overview.lowStockProducts],
      ['Out of Stock Products', data.overview.outOfStockProducts],
      [''],
      ['Live Widgets', ''],
      ['Orders (24h)', data.live.liveOrders],
      ['Visitors (30 min)', data.live.liveVisitors],
      ['Active Carts', data.live.liveCheckout],
      ['Revenue Today (BDT)', data.live.liveRevenue],
      ['Open Support Tickets', data.live.supportTickets.open],
      ['Payment Alerts', data.live.paymentAlerts.count],
      ['Fraud Alerts', data.live.fraudAlerts.count],
      [''],
      ['Revenue By Day', ''],
      ['Date', 'Revenue', 'Orders'],
      ...data.charts.revenue.map((r) => [r._id, r.revenue, r.orders]),
      [''],
      ['Sales By Day (units)', ''],
      ['Date', 'Units'],
      ...data.charts.sales.map((r) => [r._id, r.units]),
      [''],
      ['Orders By Day', ''],
      ['Date', 'Orders'],
      ...data.charts.orders.map((r) => [r._id, r.count]),
      [''],
      ['Customer Growth By Day', ''],
      ['Date', 'Customers'],
      ...data.charts.customerGrowth.map((r) => [r._id, r.count]),
      [''],
      ['Top Products', ''],
      ['Name', 'Units', 'Revenue (BDT)'],
      ...data.charts.productPerformance.map((p) => [p.name, p.units, p.revenue]),
      [''],
      ['Category Performance', ''],
      ['Category', 'Units', 'Revenue (BDT)'],
      ...data.charts.categoryPerformance.map((c) => [c.name, c.units, c.revenue]),
      [''],
      ['Payment Methods', ''],
      ['Method', 'Orders', 'Revenue (BDT)'],
      ...data.charts.paymentMethods.map((p) => [p.method, p.orders, p.revenue]),
      [''],
      ['Geographic Sales', ''],
      ['City', 'Orders', 'Revenue (BDT)'],
      ...data.charts.geography.map((g) => [g.city, g.orders, g.revenue]),
      [''],
      ['Inventory Snapshot', ''],
      ['Units in Stock', data.inventory.units],
      ['Value at Cost (BDT)', data.inventory.costValue],
      ['Value at Retail (BDT)', data.inventory.retailValue],
      ['Potential Profit (BDT)', data.inventory.potentialProfit],
      [''],
      ['Inventory By Category', ''],
      ['Category', 'Units', 'Retail Value (BDT)'],
      ...data.inventory.byCategory.map((c) => [c.name, c.units, c.retailValue]),
      [''],
      ['Promotions', ''],
      ['Coupon Orders', data.promos.couponOrders],
      ['Total Discount Given (BDT)', data.promos.totalDiscount],
      ['Coupon Revenue (BDT)', data.promos.couponRevenue],
      [''],
      ['Top Coupons', ''],
      ['Code', 'Orders', 'Discount (BDT)', 'Revenue (BDT)'],
      ...data.promos.byCoupon.map((c) => [c.code, c.orders, c.discount, c.revenue]),
      [''],
      ['Peak hours (Orders by Hour)', ''],
      ['Hour', 'Orders', 'Revenue (BDT)'],
      ...data.hourly.map((h) => [`${String(h.hour).padStart(2, '0')}:00`, h.orders, h.revenue]),
      [''],
      ['Top Customers', ''],
      ['Name', 'Email', 'Orders', 'Spend (BDT)'],
      ...data.topCustomers.map((c) => [c.name, c.email, c.orders, c.spend]),
      [''],
      ['Delivery Performance', ''],
      ['Avg Fulfillment Time (hours)', data.delivery.avgHours],
      ['Delivered (all-time)', data.delivery.deliveredCount],
      ['In Transit', data.delivery.inTransit],
      ['To Fulfill', data.delivery.toFulfill],
      [''],
      ['Refunds & Returns', ''],
      ['Pending Requests', data.refunds.pending.count],
      ['Pending Amount (BDT)', data.refunds.pending.amount],
      [''],
      ['Refund Reasons', ''],
      ['Reason', 'Count', 'Amount (BDT)'],
      ...data.refunds.byReason.map((r) => [r.reason, r.count, r.amount]),
    ];
    downloadFile('dashboard-export.csv', lines.map((l) => l.map(esc).join(',')).join('\n'), 'text/csv');
  };

  const exportJSON = () => {
    if (!data) return;
    downloadFile('dashboard-export.json', JSON.stringify({ ...data, aiInsights }, null, 2), 'application/json');
  };

  const exportPrint = () => {
    window.print();
  };

  const isEnabled = (id: WidgetId | OverviewKey) => !config.disabled[id];

  // ── Rendering helpers ───────────────────────────────────────────────────

  const kpiCards: Array<{
    key: OverviewKey;
    label: string;
    icon: any;
    color: string;
    bg: string;
    format: 'currency' | 'int' | 'pct';
    sub?: string;
    href?: string;
  }> = [
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

  const renderKpiValue = (card: (typeof kpiCards)[number]) => {
    const value = data?.overview[card.key] ?? 0;
    if (card.format === 'currency') return fmtCurrency(value);
    if (card.format === 'pct') return fmtPct(value);
    return fmtInt(value);
  };

  const activityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="h-3.5 w-3.5" />;
      case 'customer':
        return <UserPlus className="h-3.5 w-3.5" />;
      case 'review':
        return <Star className="h-3.5 w-3.5" />;
      default:
        return <TicketIcon className="h-3.5 w-3.5" />;
    }
  };

  const toChartData = (rows: ChartRow[], valueKey: 'revenue' | 'orders' | 'count' | 'units'): ChartDatum[] =>
    (rows || []).map((r) => ({ label: shortDate(r._id), value: r[valueKey] || 0 }));

  // ── Widget card wrapper (draggable) ─────────────────────────────────────
  const WidgetCard = ({
    id,
    title,
    description,
    children,
    className,
  }: {
    id: WidgetId;
    title: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
  }) => {
    const meta = WIDGET_META[id];
    return (
      <section
        draggable
        onDragStart={(e) => {
          setDragId(id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => {
          setDragId(null);
          setOverId(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (overId !== id) setOverId(id);
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop(id);
        }}
        className={cn(
          'group/card relative rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow dark:border-gray-700 dark:bg-gray-800',
          dragId === id && 'opacity-60 ring-2 ring-primary',
          overId === id && dragId !== id && 'ring-2 ring-primary/60',
          meta.span,
          className
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-3.5 dark:border-gray-700',
            dragId === id && 'cursor-grabbing'
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <GripVertical
              className={cn(
                'h-4 w-4 flex-shrink-0 text-gray-300 transition-colors dark:text-gray-600',
                'cursor-grab group-hover/card:text-gray-400 dark:group-hover/card:text-gray-400'
              )}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
              {description && <p className="truncate text-[11px] text-gray-400">{description}</p>}
            </div>
          </div>
          <span className="flex-shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 opacity-0 transition-opacity group-hover/card:opacity-100 dark:bg-gray-700">
            drag to reorder
          </span>
        </div>
        <div className="p-5">{children}</div>
      </section>
    );
  };

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case 'overview': {
        const visibleKpis = kpiCards.filter((card) => isEnabled(card.key));
        return (
          <WidgetCard id="overview" title="Overview" description="Headline store metrics for the selected period">
            {visibleKpis.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                All overview metrics are hidden — enable them in Customize.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {visibleKpis.map((card) => {
                  const inner = (
                    <>
                      <div className={cn('mb-3 flex h-8 w-8 items-center justify-center rounded-lg', card.bg)}>
                        <card.icon className={cn('h-4 w-4', card.color)} />
                      </div>
                      <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{renderKpiValue(card)}</p>
                      <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                        {card.label}
                        {card.sub && <span className="text-gray-400 dark:text-gray-500"> · {card.sub}</span>}
                      </p>
                    </>
                  );
                  return card.href ? (
                    <Link
                      key={card.key}
                      href={card.href}
                      className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 transition-colors hover:border-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/60 dark:hover:bg-gray-700/60"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div
                      key={card.key}
                      className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-800/60"
                    >
                      {inner}
                    </div>
                  );
                })}
              </div>
            )}
          </WidgetCard>
        );
      }

      case 'live':
        return (
          <WidgetCard id="live" title="Live Pulse" description="Real-time store activity">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Live Orders', value: fmtInt(data?.live.liveOrders ?? 0), sub: 'last 24 hours', icon: ShoppingCart, color: 'text-blue-600' },
                { label: 'Live Visitors', value: fmtInt(data?.live.liveVisitors ?? 0), sub: 'active now (30 min)', icon: Users, color: 'text-purple-600' },
                { label: 'Live Checkout', value: fmtInt(data?.live.liveCheckout ?? 0), sub: 'curated carts active', icon: CreditCard, color: 'text-amber-600' },
                { label: 'Live Revenue', value: fmtCurrency(data?.live.liveRevenue ?? 0), sub: 'earned today', icon: DollarSign, color: 'text-green-600' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="relative flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3.5 dark:border-gray-700 dark:bg-gray-800/60"
                >
                  <span className="absolute right-3 top-3 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', s.color.includes('blue') ? 'bg-blue-100 dark:bg-blue-900/20' : s.color.includes('purple') ? 'bg-purple-100 dark:bg-purple-900/20' : s.color.includes('amber') ? 'bg-amber-100 dark:bg-amber-900/20' : 'bg-green-100 dark:bg-green-900/20')}>
                    <s.icon className={cn('h-5 w-5', s.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
                    <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                      {s.label} · {s.sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </WidgetCard>
        );

      case 'revenue':
        return (
          <WidgetCard id="revenue" title="Revenue Analytics" description="Daily revenue (completed sales)">
            <LineChart data={toChartData(data?.charts.revenue || [], 'revenue')} format={fmtCurrency} color="#6366f1" />
          </WidgetCard>
        );

      case 'sales':
        return (
          <WidgetCard id="sales" title="Sales Analytics" description="Units sold per day">
            <BarChart data={toChartData(data?.charts.sales || [], 'units')} format={fmtInt} color="bg-blue-500" />
          </WidgetCard>
        );

      case 'orders':
        return (
          <WidgetCard id="orders" title="Order Analytics" description="Orders placed per day">
            <LineChart data={toChartData(data?.charts.orders || [], 'count')} format={fmtInt} color="#ec4899" />
          </WidgetCard>
        );

      case 'customers':
        return (
          <WidgetCard id="customers" title="Customer Growth" description="New customer accounts per day">
            <BarChart data={toChartData(data?.charts.customerGrowth || [], 'count')} format={fmtInt} color="bg-purple-500" />
          </WidgetCard>
        );

      case 'products':
        return (
          <WidgetCard id="products" title="Product Performance" description="Top sellers by revenue">
            <HBarList
              rows={(data?.charts.productPerformance || []).map((p) => ({
                label: p.name,
                value: p.revenue,
                sub: `${p.units} sold`,
                image: p.image,
              }))}
              format={fmtCurrency}
              color="bg-indigo-500"
            />
          </WidgetCard>
        );

      case 'categories':
        return (
          <WidgetCard id="categories" title="Category Performance" description="Revenue by category">
            <HBarList
              rows={(data?.charts.categoryPerformance || []).map((c) => ({
                label: c.name,
                value: c.revenue,
                sub: `${c.units} units`,
              }))}
              format={fmtCurrency}
              color="bg-emerald-500"
            />
          </WidgetCard>
        );

      case 'traffic':
        return (
          <WidgetCard id="traffic" title="Traffic Analytics" description="Views, cart adds & orders per day">
            {!data?.charts.traffic || data.charts.traffic.length === 0 ? (
              <EmptyChart height={190} message="No traffic events yet — product views, cart adds and checkouts will appear here." />
            ) : (
              <div className="space-y-4">
                <LineChart
                  data={data.charts.traffic.map((d) => ({ label: shortDate(d._id), value: d.views }))}
                  format={fmtInt}
                  color="#14b8a6"
                  height={120}
                />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-cyan-50 px-2 py-2 dark:bg-cyan-900/20">
                    <p className="text-base font-bold text-cyan-700 dark:text-cyan-300">
                      {fmtInt(data.charts.traffic.reduce((s, d) => s + d.views, 0))}
                    </p>
                    <p className="text-[10px] text-cyan-600 dark:text-cyan-400">Views</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 px-2 py-2 dark:bg-blue-900/20">
                    <p className="text-base font-bold text-blue-700 dark:text-blue-300">
                      {fmtInt(data.charts.traffic.reduce((s, d) => s + (d.carts || 0), 0))}
                    </p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400">Cart adds</p>
                  </div>
                  <div className="rounded-lg bg-purple-50 px-2 py-2 dark:bg-purple-900/20">
                    <p className="text-base font-bold text-purple-700 dark:text-purple-300">
                      {fmtInt(data.charts.traffic.reduce((s, d) => s + (d.orders || 0), 0))}
                    </p>
                    <p className="text-[10px] text-purple-600 dark:text-purple-400">Orders</p>
                  </div>
                </div>
                {(data.charts.trafficSources?.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {data.charts.trafficSources.map((s) => (
                      <span key={s.source} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium capitalize text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {s.source.replace('_', ' ')} · {fmtInt(s.views)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </WidgetCard>
        );

      case 'funnel':
        return (
          <WidgetCard id="funnel" title="Conversion Funnel" description="Visitor → delivered">
            <FunnelChart
              stages={[
                { label: 'Visitors', value: data?.charts.funnel.visitors || 0 },
                { label: 'Product views', value: data?.charts.funnel.productViews || 0 },
                { label: 'Add to cart', value: data?.charts.funnel.addToCart || 0 },
                { label: 'Checkout', value: data?.charts.funnel.checkout || 0 },
                { label: 'Orders placed', value: data?.charts.funnel.orders || 0 },
                { label: 'Delivered', value: data?.charts.funnel.delivered || 0 },
              ]}
              format={fmtInt}
            />
          </WidgetCard>
        );

      case 'geography':
        return (
          <WidgetCard id="geography" title="Geographic Sales" description="Top delivery cities">
            <HBarList
              rows={(data?.charts.geography || []).map((g) => ({
                label: g.city,
                value: g.revenue,
                sub: `${g.orders} orders`,
              }))}
              format={fmtCurrency}
              color="bg-amber-500"
            />
          </WidgetCard>
        );

      case 'payments':
        return (
          <WidgetCard id="payments" title="Payment Methods" description="Orders & revenue by gateway">
            <DonutChart
              data={(data?.charts.paymentMethods || []).map((p) => ({
                label: p.method.replace('_', ' '),
                value: p.revenue,
              }))}
              format={fmtCurrency}
              centerLabel="Revenue"
            />
          </WidgetCard>
        );

      case 'recentOrders':
        return (
          <WidgetCard id="recentOrders" title="Recent Orders" description="Latest orders">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {(data?.live.recentOrders || []).map((o) => (
                <Link
                  key={o._id}
                  href={`/admin/orders/${o.orderNumber}`}
                  className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{o.orderNumber}</p>
                    <p className="truncate text-[11px] text-gray-500">{o.user?.name || 'Guest'} · {timeAgo(o.createdAt)}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{fmtCurrency(o.total)}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusColors[o.status] || 'bg-gray-100 text-gray-600')}>
                      {o.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
              {(data?.live.recentOrders || []).length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400">No orders yet.</p>
              )}
              <div className="pt-2">
                <Link href="/admin/orders" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  View all orders <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </WidgetCard>
        );

      case 'activities':
        return (
          <WidgetCard id="activities" title="Recent Activity" description="Live events feed">
            <div className="space-y-1">
              {(data?.live.recentActivities || []).map((a) => (
                <Link
                  key={a.key}
                  href={a.href}
                  className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                    {activityIcon(a.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-100">{a.title}</p>
                    <p className="truncate text-[11px] text-gray-500">{a.detail}</p>
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-gray-400">{timeAgo(a.time)}</span>
                </Link>
              ))}
              {(data?.live.recentActivities || []).length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400">No activity yet.</p>
              )}
            </div>
          </WidgetCard>
        );

      case 'newCustomers':
        return (
          <WidgetCard id="newCustomers" title="New Customers" description={`${fmtInt(data?.live.newCustomers.count ?? 0)} in this period`}>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {(data?.live.newCustomers.recent || []).map((u) => (
                <div key={u._id} className="flex items-center justify-between gap-2 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
                      {u.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-100">{u.name}</p>
                      <p className="truncate text-[11px] text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-gray-400">{timeAgo(u.createdAt)}</span>
                </div>
              ))}
              {(data?.live.newCustomers.recent || []).length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400">No new customers in this period.</p>
              )}
              <div className="pt-2">
                <Link href="/admin/customers" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  View all customers <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </WidgetCard>
        );

      case 'tickets':
        return (
          <WidgetCard id="tickets" title="Support Tickets" description={`${fmtInt(data?.live.supportTickets.open ?? 0)} open`}>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {(data?.live.supportTickets.recent || []).map((t) => (
                <Link
                  key={t._id}
                  href="/admin/support-triage"
                  className="flex items-center justify-between gap-2 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-100">{t.subject}</p>
                    <p className="truncate text-[11px] text-gray-500">{t.ticketNumber} · {timeAgo(t.createdAt)}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium',
                      t.priority === 'urgent'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : t.priority === 'high'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                          : t.priority === 'low'
                            ? 'bg-gray-100 text-gray-600 dark:bg-gray-700'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                    )}>
                      {t.priority}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium capitalize text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
              {(data?.live.supportTickets.recent || []).length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400">No tickets yet.</p>
              )}
            </div>
          </WidgetCard>
        );

      case 'alerts':
        return (
          <WidgetCard id="alerts" title="Alerts" description="Payment, fraud & inventory watch">
            <div className="mb-4 flex flex-wrap gap-1.5">
              {(['payment', 'fraud', 'inventory'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAlertTab(tab)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                    alertTab === tab
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  )}
                >
                  {tab === 'payment' ? '⚡ Payment' : tab === 'fraud' ? '🛡 Fraud' : '📦 Inventory'}
                </button>
              ))}
            </div>

            {alertTab === 'payment' && (
              <div className="space-y-2">
                {(data?.live.paymentAlerts.recent || []).map((a) => (
                  <div key={a._id} className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-900/20">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-red-800 dark:text-red-200">
                        Payment failed · {a.orderNumber}
                      </p>
                      <p className="truncate text-[11px] text-red-600 dark:text-red-400">
                        {a.method || 'unknown gateway'} · {a.city || '—'} · {timeAgo(a.createdAt)}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-sm font-semibold text-red-700 dark:text-red-300">{fmtCurrency(a.total)}</span>
                  </div>
                ))}
                {(data?.live.paymentAlerts.recent || []).length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-400">No payment failures — all clear ✅</p>
                )}
              </div>
            )}

            {alertTab === 'fraud' && (
              <div className="space-y-2">
                {(data?.live.fraudAlerts.recent || []).map((a) => (
                  <div key={a._id} className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2.5 dark:bg-amber-900/20">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-amber-800 dark:text-amber-200">
                        {a.level === 'high' ? 'High' : 'Medium'} risk · {a.orderNumber}
                      </p>
                      <p className="truncate text-[11px] text-amber-600 dark:text-amber-400">
                        Score {a.score}/100 · {a.action?.replace('_', ' ')} · {a.city || '—'}
                      </p>
                    </div>
                    <Link href={`/admin/orders/${a.orderNumber}`} className="flex-shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700 shadow-sm transition-colors hover:bg-amber-100 dark:bg-gray-800 dark:text-amber-300">
                      Review →
                    </Link>
                  </div>
                ))}
                {(data?.live.fraudAlerts.recent || []).length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-400">No fraud alerts — orders look clean 🛡</p>
                )}
              </div>
            )}

            {alertTab === 'inventory' && (
              <div className="space-y-2">
                {(data?.live.inventoryAlerts || []).map((p) => (
                  <Link
                    key={p._id}
                    href={`/admin/products/${p.slug}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-orange-50 px-3 py-2.5 transition-colors hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {p.image ? (
                        <img src={p.image} alt="" className="h-8 w-8 flex-shrink-0 rounded object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-orange-100 dark:bg-orange-900/40">
                          <Package className="h-4 w-4 text-orange-500" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-orange-800 dark:text-orange-200">{p.name}</p>
                        <p className="truncate text-[11px] text-orange-600 dark:text-orange-400">
                          {p.stock === 0 ? 'Out of stock' : `Stock ${p.stock}`} · threshold {p.threshold}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-orange-400" />
                  </Link>
                ))}
                {(data?.live.inventoryAlerts || []).length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-400">Inventory levels are healthy 📦</p>
                )}
                <div>
                  <Link href="/admin/inventory" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Manage inventory <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}
          </WidgetCard>
        );

      case 'ai':
        return aiInsights ? (
          <WidgetCard id="ai" title="AI Insights" description="Machine-generated store analysis">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium',
                  aiInsights.source === 'ai_service'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                )}
              >
                {aiInsights.source === 'ai_service' ? 'AI Engine' : 'Local Fallback'}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Activity className="h-3.5 w-3.5" /> Health {aiInsights.health_score}/100
              </span>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <Lightbulb className="h-3.5 w-3.5 text-indigo-500" /> What's happening
                </h3>
                <ul className="space-y-2">
                  {(aiInsights.insights || []).map((ins: string, i: number) => (
                    <li key={i} className="text-[13px] text-gray-600 dark:text-gray-300">{ins}</li>
                  ))}
                  {(aiInsights.insights || []).length === 0 && <li className="text-[13px] text-gray-400">Not enough data yet.</li>}
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" /> Recommended actions
                </h3>
                <ul className="space-y-2">
                  {(aiInsights.suggestions || []).map((s: string, i: number) => (
                    <li key={i} className="text-[13px] text-purple-700 dark:text-purple-300">{s}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Revenue forecast
                </h3>
                {aiInsights.forecast && aiInsights.forecast.length > 0 ? (
                  <>
                    <div className="flex h-24 items-end gap-1.5">
                      {aiInsights.forecast.map((f: any, i: number) => {
                        const max = Math.max(...aiInsights.forecast.map((x: any) => x.revenue));
                        return (
                          <div key={i} className="flex-1" title={`${f.date}: ${fmtCurrency(f.revenue)}`}>
                            <div className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-purple-500" style={{ height: `${max > 0 ? Math.max(6, (f.revenue / max) * 100) : 6}%` }} />
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-gray-400">Projected revenue · next {aiInsights.forecast.length} days</p>
                  </>
                ) : (
                  <p className="text-[13px] text-gray-400">Add more completed orders to unlock forecasting.</p>
                )}
              </div>
            </div>
          </WidgetCard>
        ) : null;

      case 'inventory': {
        const byCategory = data?.inventory.byCategory || [];
        return (
          <WidgetCard id="inventory" title="Inventory Snapshot" description="Stock value & health (tracked products)">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Units in stock', value: fmtInt(data?.inventory.units ?? 0), icon: Boxes, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/20' },
                { label: 'Value at cost', value: fmtCurrency(data?.inventory.costValue ?? 0), icon: Coins, color: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-900/20' },
                { label: 'Value at retail', value: fmtCurrency(data?.inventory.retailValue ?? 0), icon: Warehouse, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/20' },
                { label: 'Potential profit', value: fmtCurrency(data?.inventory.potentialProfit ?? 0), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/20' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                  <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', s.bg)}>
                    <s.icon className={cn('h-4 w-4', s.color)} />
                  </div>
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{s.value}</p>
                  <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
            {byCategory.length > 0 ? (
              <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
                <h3 className="mb-3 text-xs font-semibold text-gray-700 dark:text-gray-200">Inventory value by category</h3>
                <HBarList
                  rows={byCategory.map((c) => ({
                    label: c.name,
                    value: c.retailValue,
                    sub: `${fmtInt(c.units)} units`,
                  }))}
                  format={fmtCurrency}
                  color="bg-amber-500"
                />
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-gray-700">
                No tracked inventory yet — set prices & cost in product settings.
              </p>
            )}
            <div className="mt-4">
              <Link href="/admin/inventory" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Manage inventory <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </WidgetCard>
        );
      }

      case 'promos': {
        const byCoupon = data?.promos.byCoupon || [];
        return (
          <WidgetCard id="promos" title="Promotions" description="Coupon & discount performance">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Discount given', value: fmtCurrency(data?.promos.totalDiscount ?? 0), icon: BadgePercent, color: 'text-pink-600' },
                { label: 'Coupon orders', value: fmtInt(data?.promos.couponOrders ?? 0), icon: Percent, color: 'text-fuchsia-600' },
                { label: 'Coupon revenue', value: fmtCurrency(data?.promos.couponRevenue ?? 0), icon: DollarSign, color: 'text-green-600' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-700/50">
                  <div className="flex items-center gap-1.5">
                    <s.icon className={cn('h-3.5 w-3.5', s.color)} />
                    <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">{s.label}</p>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-bold text-gray-900 dark:text-white">{s.value}</p>
                </div>
              ))}
            </div>
            {byCoupon.length > 0 ? (
              <div className="mt-4 space-y-2">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200">Top coupons this period</h3>
                {byCoupon.map((c) => (
                  <div key={c.code} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-gray-900 dark:text-white">{c.code}</p>
                      <p className="truncate text-[11px] text-gray-500">
                        {fmtInt(c.orders)} orders · {fmtCurrency(c.revenue)} revenue
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-xs font-semibold text-pink-600 dark:text-pink-400">
                      −{fmtCurrency(c.discount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-gray-700">
                No coupon orders this period — create coupons in Marketing to drive sales.
              </p>
            )}
            <div className="mt-4">
              <Link href="/admin/campaigns" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Manage campaigns & coupons <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </WidgetCard>
        );
      }

      case 'hourly':
        return (() => {
          const hours = data?.hourly || [];
          const peak = hours.reduce((best, h) => (h.orders > best.orders ? h : best), { hour: -1, orders: 0, revenue: 0 });
          return (
            <WidgetCard id="hourly" title="Peak Hours" description="Order volume by hour of day">
              {hours.length > 0 && hours.some((h) => h.orders > 0) ? (
                <>
                  <BarChart
                    data={hours.map((h) => ({ label: `${String(h.hour).padStart(2, '0')}:00`, value: h.orders }))}
                    format={fmtInt}
                    color="bg-indigo-500"
                    height={170}
                  />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Peak hour', value: peak.hour >= 0 ? `${String(peak.hour).padStart(2, '0')}:00` : '—', icon: CalendarClock, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/20' },
                      { label: 'Orders in peak hour', value: fmtInt(peak.orders), icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20' },
                      { label: 'Revenue in peak hour', value: fmtCurrency(peak.revenue), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/20' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-700/50">
                        <div className={cn('mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg', s.bg)}>
                          <s.icon className={cn('h-3.5 w-3.5', s.color)} />
                        </div>
                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{s.value}</p>
                        <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyChart height={170} message="No orders in this period — hourly patterns will appear as orders come in." />
              )}
            </WidgetCard>
          );
        })();

      case 'topCustomers':
        return (
          <WidgetCard id="topCustomers" title="Top Customers" description="Highest spenders this period">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {(data?.topCustomers || []).map((c, i) => (
                <div key={`${c.email || c.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        i === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700'
                      )}
                    >
                      {i === 0 ? <Crown className="h-4 w-4" /> : i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-100">{c.name}</p>
                      <p className="truncate text-[11px] text-gray-500">{c.email || 'guest'}</p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3 text-right">
                    <span className="text-[11px] text-gray-500">{fmtInt(c.orders)} orders</span>
                    <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{fmtCurrency(c.spend)}</span>
                  </div>
                </div>
              ))}
              {(data?.topCustomers || []).length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400">No customer spend yet.</p>
              )}
              <div className="pt-2">
                <Link href="/admin/customers" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  View all customers <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </WidgetCard>
        );

      case 'delivery':
        return (
          <WidgetCard id="delivery" title="Delivery Performance" description="Fulfillment & shipping health">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Avg. fulfillment', value: fmtDuration(data?.delivery.avgHours ?? 0), sub: 'placed → delivered', icon: Hourglass, color: 'text-cyan-600' },
                { label: 'Delivered', value: fmtInt(data?.delivery.deliveredCount ?? 0), sub: 'all time (timeline)', icon: Truck, color: 'text-green-600' },
                { label: 'In transit', value: fmtInt(data?.delivery.inTransit ?? 0), sub: 'shipped / out for delivery', icon: Truck, color: 'text-blue-600' },
                { label: 'To fulfill', value: fmtInt(data?.delivery.toFulfill ?? 0), sub: 'pending → packed', icon: Package, color: 'text-yellow-600' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-800/60">
                  <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                    <s.icon className={cn('h-4 w-4', s.color)} />
                  </div>
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{s.value}</p>
                  <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{s.label} · {s.sub}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Link href="/admin/orders" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Manage orders <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </WidgetCard>
        );

      case 'refunds': {
        const byReason = data?.refunds.byReason || [];
        return (
          <WidgetCard id="refunds" title="Refunds & Returns" description="Pending requests & reasons">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-rose-50 px-4 py-3 dark:bg-rose-900/20">
                <p className="text-lg font-bold text-rose-700 dark:text-rose-300">{fmtInt(data?.refunds.pending.count ?? 0)}</p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400">Pending refund requests</p>
              </div>
              <div className="rounded-lg bg-red-50 px-4 py-3 dark:bg-red-900/20">
                <p className="text-lg font-bold text-red-700 dark:text-red-300">{fmtCurrency(data?.refunds.pending.amount ?? 0)}</p>
                <p className="text-[11px] text-red-600 dark:text-red-400">Amount awaiting action</p>
              </div>
            </div>
            {byReason.length > 0 ? (
              <div className="mt-4">
                <h3 className="mb-3 text-xs font-semibold text-gray-700 dark:text-gray-200">Top request reasons</h3>
                <HBarList
                  rows={byReason.map((r) => ({
                    label: r.reason,
                    value: r.count,
                    sub: fmtCurrency(r.amount),
                  }))}
                  format={fmtInt}
                  color="bg-rose-500"
                />
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400 dark:border-gray-700">
                No pending refunds — all clear ✅
              </p>
            )}
            <div className="mt-4">
              <Link href="/admin/orders?status=returned" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Review returns <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </WidgetCard>
        );
      }

      default:
        return null;
    }
  };

  // ── Customize modal ─────────────────────────────────────────────────────
  const customizeModal = (
    <AnimatePresence>
      {showCustomize && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowCustomize(false)}
        >
          <motion.div
            initial={{ scale: 0.96, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 10 }}
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Customize Dashboard</h2>
                <p className="text-sm text-gray-500">Personal layout — saved to this browser. Drag cards to reorder them on the page.</p>
              </div>
              <button onClick={() => setShowCustomize(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Overview metrics
              </p>
              {kpiCards.map((card) => (
                <div key={card.key} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{card.label}</p>
                    <p className="truncate text-[11px] text-gray-400">{card.sub || 'Headline metric'}</p>
                  </div>
                  <ToggleSwitch
                    enabled={isEnabled(card.key)}
                    onToggle={() => toggleWidget(card.key)}
                    label={card.label}
                  />
                </div>
              ))}
              <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Widgets
              </p>
              {ALL_WIDGETS.map((id) => (
                <div key={id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{WIDGET_META[id].title}</p>
                    <p className="text-[11px] text-gray-400">{WIDGET_META[id].description}</p>
                  </div>
                  <ToggleSwitch
                    enabled={isEnabled(id)}
                    onToggle={() => toggleWidget(id)}
                    label={WIDGET_META[id].title}
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700">
              <button
                onClick={resetLayout}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Reset layout
              </button>
              <button
                onClick={() => setShowCustomize(false)}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Export dropdown ─────────────────────────────────────────────────────
  const exportMenu = (
    <div className="relative" ref={exportRef}>
      <button
        onClick={() => setShowExport((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <Download className="h-4 w-4" /> Export
      </button>
      <AnimatePresence>
        {showExport && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute right-0 z-30 mt-1.5 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
          >
            <button onClick={() => { exportCSV(); setShowExport(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">
              <Download className="h-4 w-4 text-gray-400" /> CSV
            </button>
            <button onClick={() => { exportJSON(); setShowExport(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">
              <Download className="h-4 w-4 text-gray-400" /> JSON
            </button>
            <button onClick={() => { exportPrint(); setShowExport(false); }} className="flex w-full items-center gap-2 border-t border-gray-100 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">
              <Eye className="h-4 w-4 text-gray-400" /> Print / PDF
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const orderSummary = Object.entries(data?.ordersByStatus || {});

  return (
    <div className="space-y-6">
      {/* ── Header / filters ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10">
            <LayoutDashboard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Welcome back! Here's what's happening with your store.
              {lastUpdated && <span className="ml-1 text-xs text-gray-400">· updated {timeAgo(lastUpdated)}</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date range */}
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
            {(['7', '30', '90', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  period === p
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                {p === 'custom' ? 'Custom' : `${p}d`}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <span className="text-xs text-gray-400">→</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
          )}

          {/* Store filter */}
          <select
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            defaultValue="all"
            title="Store filter"
          >
            <option value="all">All stores</option>
            <option value="noor">Pakistani Noor</option>
          </select>

          {/* Currency filter */}
          <select
            value={config.currency}
            onChange={(e) => setConfig((prev) => ({ ...prev, currency: e.target.value as CurrencyCode }))}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            title="Currency filter"
          >
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
              <option key={c} value={c}>
                {CURRENCIES[c].symbol} {c}
              </option>
            ))}
          </select>

          {/* Auto-refresh */}
          <button
            onClick={() => setConfig((prev) => ({ ...prev, autoRefresh: !prev.autoRefresh }))}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors',
              config.autoRefresh
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
                : 'border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-800'
            )}
            title="When enabled, live widgets refresh every 60 seconds"
          >
            <span className={cn('h-2 w-2 rounded-full', config.autoRefresh ? 'animate-pulse bg-green-500' : 'bg-gray-300')} />
            Auto
          </button>

          <button
            onClick={() => fetchData(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>

          {exportMenu}

          <button
            onClick={() => setShowCustomize(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Customize
          </button>
        </div>
      </div>

      {/* ── Order status strip ───────────────────────────────────────────── */}
      {orderSummary.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {orderSummary.map(([status, count]) => (
            <span key={status} className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium capitalize', statusColors[status] || 'bg-gray-100 text-gray-600')}>
              {count} {status.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-24 text-gray-400">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* Live Pulse is always the first widget */}
          {isEnabled('live') && renderWidget('live')}

          {config.order
            .filter((id) => id !== 'live' && id !== 'overview' && isEnabled(id))
            .map((id) => (
              <Fragment key={id}>{renderWidget(id)}</Fragment>
            ))}

          {/* Overview is always the last widget */}
          {isEnabled('overview') && renderWidget('overview')}
        </div>
      )}

      {customizeModal}

      {/* Print-only attribution */}
      <div className="hidden print:block text-xs text-gray-400">
        Pakistan Noor · Dashboard export · {new Date().toLocaleString()}
      </div>
    </div>
  );
}