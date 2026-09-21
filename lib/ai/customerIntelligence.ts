/**
 * AI Customer Intelligence & Retention (Phase 4)
 * ==============================================
 * Turns order history into a per-customer view an admin can act on:
 *
 *   1. Lifetime value (CLV) — total spend + average order value.
 *   2. Churn risk scoring — recency + frequency model (0-100, higher = at risk).
 *   3. Segments — vip / high_value / active / at_risk / churned / new / one_time.
 *   4. Suggested retention action per customer (deterministic playbooks).
 *
 * Deterministic engine: the API route gathers the data, this module decides.
 */

export type CustomerSegment =
  | 'vip'
  | 'high_value'
  | 'active'
  | 'at_risk'
  | 'churned'
  | 'new'
  | 'one_time';

export interface CustomerOrderAggregate {
  totalSpend: number;
  orderCount: number;
  lastOrderAt?: Date;
  avgOrderValue: number;
}

export interface CustomerRecord {
  userId: string;
  name: string;
  email: string;
  image?: string;
  accountCreatedAt?: Date;
  totalSpend: number;
  orderCount: number;
  avgOrderValue: number;
  daysSinceLastOrder: number | null;
  churnScore: number;
  segment: CustomerSegment;
  suggestedAction: string;
  actionChannel: 'email' | 'push' | 'sms';
  winbackMessage: string;
}

export interface SegmentSummary {
  segment: CustomerSegment;
  count: number;
  totalValue: number;
}

export interface CustomerIntelligence {
  generatedAt: string;
  summary: {
    totalCustomers: number;
    atRiskCustomers: number;
    churnedCustomers: number;
    vipCustomers: number;
    atRiskValue: number;
    totalValue: number;
  };
  segments: SegmentSummary[];
  customers: CustomerRecord[];
}

const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  vip: 'VIP',
  high_value: 'High value',
  active: 'Active',
  at_risk: 'At risk',
  churned: 'Churned',
  new: 'New',
  one_time: 'One-time',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Recency score (0-100). Higher daysSinceLastOrder → higher churn pressure. */
function recencyScore(days: number | null): number {
  if (days === null) return 100;
  if (days >= 180) return 95;
  if (days >= 90) return 85;
  if (days >= 60) return 72;
  if (days >= 30) return 58;
  if (days >= 14) return 40;
  if (days >= 7) return 24;
  return 12;
}

export function classifyCustomer(
  orderAgg: CustomerOrderAggregate,
  firstNames: { firstName: string },
  now: Date = new Date()
): Pick<CustomerRecord, 'churnScore' | 'segment' | 'suggestedAction' | 'actionChannel' | 'winbackMessage' | 'daysSinceLastOrder'> {
  const { totalSpend, orderCount, lastOrderAt, avgOrderValue } = orderAgg;

  const daysSinceLastOrder =
    lastOrderAt != null
      ? Math.max(0, Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / 86_400_000))
      : null;

  let churnScore = recencyScore(daysSinceLastOrder);
  if (orderCount === 1) churnScore += 10;
  else if (orderCount === 2) churnScore += 5;
  if (orderCount >= 10) churnScore -= 18;
  else if (orderCount >= 5) churnScore -= 10;
  churnScore = clamp(churnScore, 0, 100);

  let segment: CustomerSegment;
  if (totalSpend >= 20000) segment = 'vip';
  else if (totalSpend >= 7500) segment = 'high_value';
  else if (churnScore >= 85 || (daysSinceLastOrder !== null && daysSinceLastOrder >= 120)) segment = 'churned';
  else if (churnScore >= 45) segment = 'at_risk';
  else if (orderCount === 1 && daysSinceLastOrder !== null && daysSinceLastOrder >= 30) segment = 'one_time';
  else if (orderCount <= 2 && (daysSinceLastOrder === null || daysSinceLastOrder < 30)) segment = 'new';
  else segment = 'active';

  // Deterministic retention playbooks.
  let suggestedAction: string;
  let actionChannel: CustomerRecord['actionChannel'];
  if (segment === 'churned') {
    suggestedAction = `Send "We miss you" win-back email with a ৳${Math.min(300, Math.max(100, Math.round(avgOrderValue * 0.1 / 50) * 50))} coupon`;
    actionChannel = 'email';
  } else if (segment === 'at_risk') {
    suggestedAction = 'Win-back email nudging recently viewed items + free-shipping reminder';
    actionChannel = 'email';
  } else if (segment === 'vip') {
    suggestedAction = 'Exclusive early-access offer + personalised loyalty rewards';
    actionChannel = 'push';
  } else if (segment === 'high_value') {
    suggestedAction = 'Personalised product recommendations + express-delivery perk';
    actionChannel = 'push';
  } else if (segment === 'one_time') {
    suggestedAction = 'Trigger taste-profile recommendations for a second purchase';
    actionChannel = 'email';
  } else if (segment === 'new') {
    suggestedAction = 'Onboarding sequence: order tracking + loyalty points explainer';
    actionChannel = 'push';
  } else {
    suggestedAction = 'Periodic re-engagement with seasonal offers';
    actionChannel = 'push';
  }

  const firstName = firstNames.firstName || 'there';
  const winbackMessage =
    segment === 'churned' || segment === 'at_risk'
      ? `Hi ${firstName}, it has been a while since your last order — and we miss you! 👋 Here is ${Math.round(avgOrderValue * 0.1)} off your next order, plus free delivery across Bangladesh. Your favourites are still waiting at pakistannoor.com. ❤️`
      : segment === 'vip' || segment === 'high_value'
        ? `Hi ${firstName}, thank you for being one of our most valued customers! ⭐ Enjoy early access to our latest arrivals and an exclusive reward on your next order at pakistannoor.com.`
        : `Hi ${firstName}, fresh finds are waiting just for you at pakistannoor.com — with fast delivery and easy 7-day returns across Bangladesh. 😊`;

  return {
    churnScore,
    segment,
    suggestedAction,
    actionChannel,
    winbackMessage,
    daysSinceLastOrder,
  };
}

export function computeCustomerIntelligence(
  users: Array<{
    userId: string;
    name: string;
    email: string;
    image?: string;
    accountCreatedAt?: Date;
    orderAgg: CustomerOrderAggregate;
  }>,
  now: Date = new Date()
): CustomerIntelligence {
  const customers: CustomerRecord[] = users.map((u) => {
    const firstName = (u.name || '').trim().split(/\s+/)[0];
    const classified = classifyCustomer(u.orderAgg, { firstName }, now);
    return {
      userId: u.userId,
      name: u.name,
      email: u.email,
      image: u.image,
      accountCreatedAt: u.accountCreatedAt,
      totalSpend: Math.round(u.orderAgg.totalSpend),
      orderCount: u.orderAgg.orderCount,
      avgOrderValue: Math.round(u.orderAgg.avgOrderValue),
      ...classified,
    };
  });

  customers.sort(
    (a, b) => b.churnScore - a.churnScore || b.totalSpend - a.totalSpend
  );

  const totalValue = customers.reduce((sum, c) => sum + c.totalSpend, 0);
  const atRisk = customers.filter((c) => c.segment === 'at_risk' || c.segment === 'churned');
  const atRiskValue = atRisk.reduce((sum, c) => sum + c.totalSpend, 0);

  const segmentCounts = new Map<CustomerSegment, { count: number; value: number }>();
  for (const c of customers) {
    const entry = segmentCounts.get(c.segment) || { count: 0, value: 0 };
    entry.count += 1;
    entry.value += c.totalSpend;
    segmentCounts.set(c.segment, entry);
  }

  const segments: SegmentSummary[] = (Object.keys(SEGMENT_LABELS) as CustomerSegment[])
    .map((segment) => {
      const entry = segmentCounts.get(segment);
      return entry
        ? { segment, count: entry.count, totalValue: Math.round(entry.value) }
        : { segment, count: 0, totalValue: 0 };
    })
    .filter((s) => s.count > 0);

  return {
    generatedAt: now.toISOString(),
    summary: {
      totalCustomers: customers.length,
      atRiskCustomers: atRisk.filter((c) => c.segment === 'at_risk').length,
      churnedCustomers: atRisk.filter((c) => c.segment === 'churned').length,
      vipCustomers: customers.filter((c) => c.segment === 'vip').length,
      atRiskValue: Math.round(atRiskValue),
      totalValue: Math.round(totalValue),
    },
    segments,
    customers: customers.slice(0, 200),
  };
}

export { SEGMENT_LABELS };