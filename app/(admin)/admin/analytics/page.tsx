'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Package,
  Wallet,
  RotateCcw,
  DollarSign,
  RefreshCw,
  Loader2,
  Target,
  Repeat,
  Percent,
  UserPlus,
  PackageX,
  ShoppingCart,
  BarChart3,
  CalendarClock,
  BadgePercent,
  Undo2,
  Crown,
  Coins,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  BarChart,
  FunnelChart,
  HBarList,
  DonutChart,
  EmptyChart,
} from '@/components/admin/dashboard/charts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RevenueByDay {
  _id: string;
  revenue: number;
  orders: number;
}

interface UnitsByDay {
  _id: string;
  units: number;
}

interface CategoryRow {
  name: string;
  revenue: number;
  units: number;
}

interface ProductRow {
  _id: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

interface PaymentRow {
  method: string;
  orders: number;
  revenue: number;
}

interface CityRow {
  city: string;
  orders: number;
  revenue: number;
}

interface ProductStat {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  viewCount: number;
  salesCount: number;
  wishlistCount: number;
  conversionRate: number;
}

interface Totals {
  revenue: number;
  orders: number;
  units: number;
  avgOrderValue: number;
  grossMargin: number;
  netMargin: number;
  refundRate: number;
  customers: number;
  products: number;
  delivered: number;
  cancelled: number;
  returned: number;
  refunded: number;
  refundedAmount: number;
  payFailed: number;
  totalDiscount: number;
  couponOrders: number;
  discountRate: number;
  loyaltyEarned: number;
  loyaltyUsed: number;
}

interface CustomerAnalytics {
  acquisition: number;
  acquisitionByDay: Array<{ _id: string; count: number }>;
  activeCustomers: number;
  retentionRate: number | null;
  churnRate: number | null;
  clv: number;
  repeatPurchaseRate: number;
}

interface Funnel {
  visitors: number;
  productViews: number;
  addToCart: number;
  checkout: number;
  payment: number;
  orders: number;
}

interface AnalyticsData {
  range: { from: string; to: string; days: number };
  totals: Totals;
  revenueByDay: RevenueByDay[];
  unitsByDay: UnitsByDay[];
  salesByCategory: CategoryRow[];
  topProducts: ProductRow[];
  paymentMethods: PaymentRow[];
  topCities: CityRow[];
  productAnalytics: {
    mostViewed: ProductStat[];
    mostPurchased: ProductStat[];
    mostWishlisted: ProductStat[];
    lowPerforming: ProductStat[];
    topConversion: ProductStat[];
  };
  customerAnalytics: CustomerAnalytics;
  funnel: Funnel;
  hourlyOrders: Array<{ hour: number; orders: number; revenue: number }>;
  weekdayOrders: Array<{ day: string; orders: number; revenue: number }>;
  promoStats: {
    couponOrders: number;
    totalDiscount: number;
    couponRevenue: number;
    discountRate: number;
    byCoupon: Array<{ code: string; orders: number; discount: number; revenue: number }>;
  };
  refundAnalytics: {
    totalCount: number;
    totalAmount: number;
    byStatus: Array<{ status: string; count: number; amount: number }>;
    byReason: Array<{ reason: string; count: number; amount: number }>;
  };
  topCustomers: Array<{ name: string; email?: string; orders: number; spend: number }>;
  orderSources: Array<{ source: string; orders: number; revenue: number }>;
  loyalty: { pointsEarned: number; pointsUsed: number };
}

const currency = (n: number) => `৳${Math.round(n).toLocaleString()}`;
const int = (n: number) => Math.round(n).toLocaleString();
const pct = (n: number) => `${n}%`;
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

const rangeOptions = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Card({
  title,
  subtitle,
  children,
  className,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800',
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
          {subtitle && <p className="truncate text-[11px] text-gray-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  sub,
}: {
  label: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', bg)}>
          <Icon className={cn('h-4.5 w-4.5', color)} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
          <p className="truncate text-base font-bold text-gray-900 dark:text-white">{value}</p>
          {sub && <p className="truncate text-[10px] text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: any;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10">
        <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

// Product list card wrapper (reused for most viewed / purchased / etc.)
function ProductRankCard({
  title,
  subtitle,
  rows,
  format,
  color,
  empty,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ label: string; sub?: string | number; image?: string; value: number }>;
  format: (n: number) => string;
  color: string;
  empty: string;
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      <HBarList rows={rows} format={format} color={color} empty={empty} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/analytics?days=${days}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load analytics');
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals;
  const ca = data?.customerAnalytics;
  const pa = data?.productAnalytics;

  const toDatum = useCallback(
    (rows: Array<{ _id: string; [k: string]: any }>, key: string) =>
      (rows || []).map((r) => ({
        label: new Date(r._id).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: r[key] || 0,
      })),
    []
  );

  const salesCards = useMemo(
    () => [
      { label: 'Revenue', value: currency(t?.revenue ?? 0), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/20' },
      { label: 'Orders', value: int(t?.orders ?? 0), icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20' },
      { label: 'Units Sold', value: int(t?.units ?? 0), icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/20' },
      { label: 'Avg Order Value', value: currency(t?.avgOrderValue ?? 0), icon: TrendingUp, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/20' },
      { label: 'Gross Margin', value: pct(t?.grossMargin ?? 0), icon: Percent, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/20', sub: 'revenue − COGS' },
      { label: 'Net Margin', value: pct(t?.netMargin ?? 0), icon: Wallet, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/20', sub: 'after refunds' },
      { label: 'Refund Rate', value: pct(t?.refundRate ?? 0), icon: RotateCcw, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/20', sub: `${currency(t?.refundedAmount ?? 0)} refunded` },
    ],
    [t]
  );

  const customerCards = useMemo(
    () => [
      { label: 'Active Customers', value: int(ca?.activeCustomers ?? 0), icon: Users, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/20', sub: 'ordered this period' },
      { label: 'New Customers', value: int(ca?.acquisition ?? 0), icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/20', sub: 'accounts created' },
      { label: 'Retention Rate', value: ca?.retentionRate != null ? pct(ca.retentionRate) : '—', icon: Repeat, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/20', sub: 're-ordered from before' },
      { label: 'Repeat Purchase', value: pct(ca?.repeatPurchaseRate ?? 0), icon: ShoppingCart, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/20', sub: '≥ 2 orders in period' },
      { label: 'Churn Rate', value: ca?.churnRate != null ? pct(ca.churnRate) : '—', icon: PackageX, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/20', sub: 'inactive from before' },
      { label: 'Customer LTV', value: currency(ca?.clv ?? 0), icon: Target, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/20', sub: 'lifetime revenue / customer' },
    ],
    [ca]
  );

  const funnelStages = useMemo(
    () => [
      { label: 'Visitors', value: data?.funnel.visitors ?? 0 },
      { label: 'Product Views', value: data?.funnel.productViews ?? 0 },
      { label: 'Add to Cart', value: data?.funnel.addToCart ?? 0 },
      { label: 'Checkout', value: data?.funnel.checkout ?? 0 },
      { label: 'Payment', value: data?.funnel.payment ?? 0 },
      { label: 'Orders Placed', value: data?.funnel.orders ?? 0 },
    ],
    [data?.funnel]
  );

  const productCards = useMemo<Array<{
    title: string;
    subtitle: string;
    rows: Array<{ label: string; sub?: string | number; image?: string; value: number }>;
    format: (n: number) => string;
    color: string;
    empty: string;
  }>>(() => [
    {
      title: 'Most Purchased',
      subtitle: 'By lifetime units sold',
      rows: (pa?.mostPurchased || []).map((p) => ({
        label: p.name,
        value: p.salesCount,
        sub: `${int(p.salesCount)} sold · ${pct(p.conversionRate)} conv`,
        image: p.image,
      })),
      format: int,
      color: 'bg-blue-500',
      empty: 'No product sales yet.',
    },
    {
      title: 'Most Viewed',
      subtitle: 'Product detail page views',
      rows: (pa?.mostViewed || []).map((p) => ({
        label: p.name,
        value: p.viewCount,
        sub: `${int(p.viewCount)} views · ${int(p.salesCount)} sold`,
        image: p.image,
      })),
      format: int,
      color: 'bg-indigo-500',
      empty: 'No product views yet.',
    },
    {
      title: 'Most Wishlisted',
      subtitle: 'Products customers save most',
      rows: (pa?.mostWishlisted || []).map((p) => ({
        label: p.name,
        value: p.wishlistCount,
        sub: `${int(p.wishlistCount)} wishlists`,
        image: p.image,
      })),
      format: int,
      color: 'bg-pink-500',
      empty: 'No wishlist activity yet.',
    },
    {
      title: 'Top Converting',
      subtitle: 'Highest views → sales rate',
      rows: (pa?.topConversion || []).map((p) => ({
        label: p.name,
        value: p.conversionRate,
        sub: `${int(p.viewCount)} views · ${int(p.salesCount)} sold`,
        image: p.image,
      })),
      format: pct,
      color: 'bg-emerald-500',
      empty: 'No products with views yet.',
    },
    {
      title: 'Low-Performing',
      subtitle: 'Views without sales (worst first)',
      rows: (pa?.lowPerforming || []).map((p) => ({
        label: p.name,
        value: p.viewCount ? p.salesCount / p.viewCount : 0,
        sub: `${int(p.viewCount)} views · ${int(p.salesCount)} sold · ${pct(p.conversionRate)} conv`,
        image: p.image,
      })),
      format: (n) => `${Math.round(n * 100)}%`,
      color: 'bg-amber-500',
      empty: 'No products with views yet.',
    },
    {
      title: 'Top Products',
      subtitle: 'By revenue in this period',
      rows: (data?.topProducts || []).map((p) => ({
        label: p.name,
        value: p.revenue,
        sub: `${p.unitsSold} sold`,
      })),
      format: currency,
      color: 'bg-violet-500',
      empty: 'No product sales in this period.',
    },
  ], [pa, data?.topProducts]);

  // Precomputed stats for the "Peak shopping times" section.
  const hourStats = useMemo(() => {
    const hours = data?.hourlyOrders || [];
    const peak = hours.reduce((best, h) => (h.orders > best.orders ? h : best), { hour: 0, orders: 0, revenue: 0 });
    const total = hours.reduce((s, h) => s + h.orders, 0);
    const quiet = hours.reduce((best, h) => (h.orders < best.orders ? h : best), { hour: 0, orders: Infinity });
    return {
      peak,
      quiet,
      total,
      peakLabel: peak.orders > 0 ? hourLabel(peak.hour) : '—',
      peakShare: peak.orders > 0 && total > 0 ? pct(Math.round((peak.orders / total) * 100)) : '—',
      quietLabel: quiet.orders === Infinity ? '—' : hourLabel(quiet.hour),
    };
  }, [data?.hourlyOrders]);

  const weekdayStats = useMemo(() => {
    const daysArr = data?.weekdayOrders || [];
    const best = daysArr.reduce((b, d) => (d.orders > b.orders ? d : b), daysArr[0]);
    const total = daysArr.reduce((s, d) => s + d.orders, 0);
    const weekend = daysArr
      .filter((d) => d.day === 'Sat' || d.day === 'Sun')
      .reduce((s, d) => s + d.orders, 0);
    return {
      best,
      total,
      bestLabel: best?.orders > 0 ? best.day : '—',
      bestShare: total > 0 ? pct(Math.round((best?.orders || 0) / total * 100)) : '',
      weekendShare: total > 0 ? pct(Math.round((weekend / total) * 100)) : '—',
    };
  }, [data?.weekdayOrders]);

  // Promo / refund stat card arrays, memoized.
  const promoCards = useMemo(
    () => [
      { label: 'Discount Given', value: currency(t?.totalDiscount ?? 0), icon: BadgePercent, color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/20', sub: 'total coupon value' },
      { label: 'Coupon Orders', value: int(t?.couponOrders ?? 0), icon: Percent, color: 'text-fuchsia-600', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/20', sub: 'orders with coupons' },
      { label: 'Coupon Revenue', value: currency(data?.promoStats.couponRevenue ?? 0), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/20', sub: 'revenue on promo orders' },
      { label: 'Discount Rate', value: pct(t?.discountRate ?? 0), icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/20', sub: 'share of gross sales' },
      { label: 'Promo AOV', value: currency(data?.promoStats.couponOrders ? (data.promoStats.couponRevenue / data.promoStats.couponOrders) : 0), icon: ShoppingBag, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/20', sub: 'avg promo order' },
      { label: 'Loyalty Points', value: int(t?.loyaltyEarned ?? 0), icon: Coins, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/20', sub: `${int(t?.loyaltyUsed ?? 0)} redeemed` },
    ],
    [t, data?.promoStats]
  );

  const refundCards = useMemo(
    () => [
      { label: 'Requests', value: int(data?.refundAnalytics.totalCount ?? 0), icon: Undo2, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/20', sub: 'all statuses' },
      { label: 'Requested Value', value: currency(data?.refundAnalytics.totalAmount ?? 0), icon: RotateCcw, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/20', sub: 'total amount' },
      { label: 'Refunded Amount', value: currency(t?.refundedAmount ?? 0), icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-900/20', sub: 'completed in period' },
      { label: 'Refund Rate', value: pct(t?.refundRate ?? 0), icon: Percent, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/20', sub: 'of revenue' },
    ],
    [data?.refundAnalytics, t]
  );

  const maxCityOrders = useMemo(
    () => Math.max(1, ...(data?.topCities || []).map((c) => c.orders)),
    [data?.topCities]
  );

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sales, product, customer and funnel performance over the selected period.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800">
            {rangeOptions.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setDays(opt.days)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  days === opt.days
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-20 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Sales analytics ──────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionTitle
              icon={BarChart3}
              title="Sales analytics"
              subtitle={`Revenue, volume and margin for the last ${days} days`}
            />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-7">
              {salesCards.map((card) => (
                <StatCard key={card.label} {...card} />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card
                title="Revenue"
                subtitle="Completed sales value per day"
                action={
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700">
                    {currency(t?.revenue ?? 0)} total
                  </span>
                }
              >
                {data?.revenueByDay?.length ? (
                  <LineChart
                    data={toDatum(data.revenueByDay, 'revenue')}
                    format={currency}
                    color="#6366f1"
                    height={210}
                  />
                ) : (
                  <EmptyChart height={210} message="No orders in this period yet." />
                )}
              </Card>
              <Card
                title="Units Sold"
                subtitle="Product quantity sold per day"
                action={
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700">
                    {int(t?.units ?? 0)} total
                  </span>
                }
              >
                {data?.unitsByDay?.length ? (
                  <BarChart
                    data={toDatum(data.unitsByDay, 'units')}
                    format={int}
                    color="bg-blue-500"
                    height={210}
                  />
                ) : (
                  <EmptyChart height={210} message="No units sold in this period yet." />
                )}
              </Card>
            </div>
          </section>

          {/* ── Conversion funnel ────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionTitle
              icon={Target}
              title="Conversion funnel"
              subtitle="Visitor → product view → cart → checkout → payment → order"
            />
            <Card
              title="Purchase Journey"
              subtitle="Each stage shows the conversion from the previous stage"
            >
              <FunnelChart stages={funnelStages} format={int} />
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {funnelStages.slice(1).map((stage, i) => {
                  const prev = funnelStages[i].value || 0;
                  const rate = prev > 0 ? Math.round((stage.value / prev) * 100) : 0;
                  return (
                    <div key={stage.label} className="rounded-lg bg-gray-50 px-3 py-2 text-center dark:bg-gray-700/50">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{rate}%</p>
                      <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">
                        {funnelStages[i].label} → {stage.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>

          {/* ── Product analytics ────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionTitle
              icon={Package}
              title="Product analytics"
              subtitle="What's selling, what's viewed, and what needs attention"
            />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {productCards.map((card) => (
                <ProductRankCard key={card.title} {...card} />
              ))}
            </div>
          </section>

          {/* ── Customer analytics ───────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionTitle
              icon={Users}
              title="Customer analytics"
              subtitle="Acquisition, retention and lifetime value"
            />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {customerCards.map((card) => (
                <StatCard key={card.label} {...card} />
              ))}
            </div>
            <Card
              title="Customer Acquisition"
              subtitle="New customer accounts created per day"
            >
              {ca?.acquisitionByDay?.length ? (
                <BarChart
                  data={toDatum(ca.acquisitionByDay, 'count')}
                  format={int}
                  color="bg-purple-500"
                  height={190}
                />
              ) : (
                <EmptyChart height={190} message="No new customers in this period yet." />
              )}
            </Card>
          </section>

          {/* ── Sales mix ────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionTitle
              icon={ShoppingBag}
              title="Sales mix"
              subtitle="Where revenue comes from"
            />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <Card title="Sales by Category" subtitle="Revenue in this period">
                {data?.salesByCategory?.length ? (
                  <HBarList
                    rows={data.salesByCategory.slice(0, 8).map((c) => ({
                      label: c.name,
                      value: c.revenue,
                      sub: `${c.units} units`,
                    }))}
                    format={currency}
                    color="bg-emerald-500"
                  />
                ) : (
                  <EmptyChart height={140} message="No category sales yet." />
                )}
              </Card>

              <Card title="Payment Methods" subtitle="Orders & revenue by gateway">
                {data?.paymentMethods?.length ? (
                  <DonutChart
                    data={data.paymentMethods.map((pm) => ({
                      label: pm.method.replace('_', ' '),
                      value: pm.revenue,
                    }))}
                    format={currency}
                    centerLabel="Revenue"
                  />
                ) : (
                  <EmptyChart height={140} message="No payment data yet." />
                )}
              </Card>

              <Card title="Top Delivery Cities" subtitle="Most active shipping cities">
                {data?.topCities?.length ? (
                  <div className="space-y-3">
                    {data.topCities.map((c) => (
                      <div key={c.city}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-700 dark:text-gray-200">{c.city}</span>
                          <span className="text-gray-500">
                            {c.orders} orders · {currency(c.revenue)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{
                              width: `${Math.max(2, (c.orders / maxCityOrders) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyChart height={140} message="No shipping data yet." />
                )}

                <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-700">
                  <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Order Status</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: 'Delivered', value: t?.delivered ?? 0, cls: 'text-green-600' },
                      { label: 'Cancelled', value: t?.cancelled ?? 0, cls: 'text-red-500' },
                      { label: 'Returned', value: t?.returned ?? 0, cls: 'text-amber-600' },
                      { label: 'Refunded', value: t?.refunded ?? 0, cls: 'text-red-600' },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
                        <span className="text-gray-500">{s.label}</span>
                        <span className={cn('font-medium', s.cls)}>{int(s.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* ── Peak times ──────────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionTitle
              icon={CalendarClock}
              title="Peak shopping times"
              subtitle="When your customers place orders"
            />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card
                title="Orders by Hour"
                subtitle="24-hour distribution (all days)"
                action={
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700">
                    Peak {hourStats.peakLabel}
                  </span>
                }
              >
                {data?.hourlyOrders?.some((h) => h.orders > 0) ? (
                  <>
                    <BarChart
                      data={data.hourlyOrders.map((h) => ({ label: hourLabel(h.hour), value: h.orders }))}
                      format={int}
                      color="bg-indigo-500"
                      height={190}
                    />
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Peak hour', value: hourStats.peakLabel },
                        { label: 'Peak share', value: hourStats.peakShare },
                        { label: 'Quietest hour', value: hourStats.quietLabel },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{s.value}</p>
                          <p className="truncate text-[10px] text-gray-500 dark:text-gray-400">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyChart height={190} message="No orders in this period yet." />
                )}
              </Card>

              <Card title="Orders by Weekday" subtitle="Which days of the week bring orders">
                {data?.weekdayOrders?.some((d) => d.orders > 0) ? (
                  <>
                    <BarChart
                      data={data.weekdayOrders.map((d) => ({ label: d.day, value: d.orders }))}
                      format={int}
                      color="bg-cyan-500"
                      height={190}
                    />
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {[
                        { label: 'Busiest day', value: weekdayStats.bestLabel, sub: weekdayStats.bestShare ? `${weekdayStats.bestShare} of orders` : '' },
                        { label: 'Weekend share', value: weekdayStats.weekendShare, sub: 'Sat + Sun' },
                      ].map((s) => (
                        <div key={s.label} className="rounded-lg bg-cyan-50 px-3 py-2 dark:bg-cyan-900/20">
                          <p className="truncate text-sm font-bold text-cyan-700 dark:text-cyan-300">{s.value}</p>
                          <p className="truncate text-[10px] text-cyan-600 dark:text-cyan-400">{s.label}{s.sub ? ` · ${s.sub}` : ''}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyChart height={190} message="No orders in this period yet." />
                )}
              </Card>
            </div>
          </section>

          {/* ── Promotions & discounts ──────────────────────────────────── */}
          <section className="space-y-4">
            <SectionTitle
              icon={BadgePercent}
              title="Promotions & discounts"
              subtitle="Coupon performance and discount efficiency"
            />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {promoCards.map((card) => (
                <StatCard key={card.label} {...card} />
              ))}
            </div>
            <Card
              title="Top Coupons"
              subtitle="Most-used codes this period, by discount amount"
              action={
                <Link href="/admin/campaigns" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Manage campaigns <ArrowRight className="lucide lucide-arrow-right h-3 w-3" />
                </Link>
              }
            >
              {data?.promoStats.byCoupon?.length ? (
                <HBarList
                  rows={data.promoStats.byCoupon.map((c) => ({
                    label: c.code,
                    value: c.discount,
                    sub: `${int(c.orders)} orders · ${currency(c.revenue)} rev`,
                  }))}
                  format={currency}
                  color="bg-pink-500"
                  empty="No coupon usage in this period."
                />
              ) : (
                <EmptyChart height={140} message="No coupon usage in this period — create coupons in Marketing." />
              )}
            </Card>
          </section>

          {/* ── Refunds & returns ───────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionTitle
              icon={Undo2}
              title="Refunds & returns"
              subtitle="Request volume, value and common reasons"
            />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {refundCards.map((card) => (
                <StatCard key={card.label} {...card} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card title="By Reason" subtitle="Why customers request refunds">
                {data?.refundAnalytics.byReason?.length ? (
                  <HBarList
                    rows={data.refundAnalytics.byReason.map((r) => ({
                      label: r.reason,
                      value: r.count,
                      sub: currency(r.amount),
                    }))}
                    format={int}
                    color="bg-rose-500"
                    empty="No refund requests in this period."
                  />
                ) : (
                  <EmptyChart height={140} message="No refund requests — all clear ✅" />
                )}
              </Card>
              <Card title="By Status" subtitle="Refund pipeline breakdown">
                {data?.refundAnalytics.byStatus?.length ? (
                  <div className="space-y-2.5">
                    {[
                      { key: 'pending', label: 'Pending', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
                      { key: 'approved', label: 'Approved', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
                      { key: 'rejected', label: 'Rejected', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
                      { key: 'completed', label: 'Completed', cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
                    ].map((s) => {
                      const row = data.refundAnalytics.byStatus.find((r) => r.status === s.key);
                      return (
                        <div key={s.key} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 dark:border-gray-700">
                          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium capitalize', s.cls)}>{s.label}</span>
                          <span className="text-xs text-gray-500">
                            <span className="font-semibold text-gray-900 dark:text-white">{int(row?.count ?? 0)}</span> requests · {currency(row?.amount ?? 0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyChart height={140} message="No refund requests yet." />
                )}
                <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
                  <Link href="/admin/orders?status=returned" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Review returns queue <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </Card>
            </div>
          </section>

          {/* ── Top customers & order sources ───────────────────────────── */}
          <section className="space-y-4">
            <SectionTitle
              icon={Crown}
              title="Top customers & order sources"
              subtitle="Who spends the most and where orders come from"
            />
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <Card
                title="Top Customers"
                subtitle="Highest spenders in this period"
                className="lg:col-span-2"
                action={
                  <Link href="/admin/customers" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    All customers <ArrowRight className="h-3 w-3" />
                  </Link>
                }
              >
                {data?.topCustomers?.length ? (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {data.topCustomers.map((c, i) => (
                      <div key={`${c.email || c.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                              i === 0
                                ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700'
                            )}
                          >
                            {i === 0 ? <Crown className="h-4 w-4" /> : i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                            <p className="truncate text-[11px] text-gray-500">{c.email || 'guest'}</p>
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-4 text-right">
                          <span className="text-[11px] text-gray-500">{int(c.orders)} orders</span>
                          <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{currency(c.spend)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyChart height={140} message="No customer spend in this period yet." />
                )}
              </Card>

              <Card title="Order Sources" subtitle="Where orders were placed">
                {data?.orderSources?.length ? (
                  <DonutChart
                    data={data.orderSources.map((s) => ({
                      label: s.source.replace('_', ' '),
                      value: s.revenue,
                    }))}
                    format={currency}
                    centerLabel="Revenue"
                  />
                ) : (
                  <EmptyChart height={140} message="No orders in this period yet." />
                )}
                {(data?.orderSources?.length ?? 0) > 1 && (
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-xs dark:border-gray-700">
                    {data?.orderSources?.map((s) => (
                      <div key={s.source} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50">
                        <span className="capitalize text-gray-500">{s.source.replace('_', ' ')}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{int(s.orders)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
}