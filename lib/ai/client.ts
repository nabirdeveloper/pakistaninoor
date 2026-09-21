/**
 * AI Service client — resilient connectivity layer between the Next.js app
 * and the Python AI microservice (microservices/ai-python/main.py).
 *
 * Design:
 *  - All calls go through `callAI()`, which applies a timeout and never throws.
 *  - Every high-level helper returns `null` on failure so API routes can fall
 *    back to deterministic in-app logic (recommendations, insights, etc.).
 *  - The service URL is read from AI_SERVICE_URL (server-side only).
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const aiConfig = {
  baseUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  timeoutMs: Number(process.env.AI_TIMEOUT_MS || 4000),
  enabled: (process.env.AI_SERVICE_URL || 'http://localhost:8000') !== '',
};

// ---------------------------------------------------------------------------
// Request/response types
// ---------------------------------------------------------------------------

export interface CatalogProductInput {
  id: string;
  name: string;
  slug?: string;
  category?: string;
  categoryId?: string;
  tags?: string[];
  description?: string;
  price?: number;
  salesCount?: number;
  averageRating?: number;
  image?: string;
  /** @added Phase 1 – used by the product Q&A auto-answer engine */
  stock?: number;
  compareAtPrice?: number;
}

export interface RecommendationInput {
  userId?: string;
  viewedProducts?: string[];
  purchasedProducts?: string[];
  cartProducts?: string[];
  catalog: CatalogProductInput[];
  excludeIds?: string[];
  limit?: number;
}

export interface RecommendedItem {
  productId: string;
  score: number;
  reason: string;
}

export interface RecommendationResult {
  recommendations: RecommendedItem[];
  strategy: string;
  reasons: Record<string, string>;
}

export interface DescriptionInput {
  name: string;
  category: string;
  features: string[];
  price: number;
  brand?: string;
  targetAudience?: string;
  tone?: 'professional' | 'persuasive' | 'friendly' | 'luxury';
  style?: 'concise' | 'standard' | 'detailed';
  market?: string;
}

export interface DescriptionResult {
  short_description: string;
  full_description: string;
  engine: 'llm' | 'template';
  generated_at: string;
}

export interface SEOInput {
  title: string;
  description: string;
  category: string;
  keywords?: string[];
}

export interface SEOResult {
  meta_title: string;
  meta_description: string;
  keywords: string[];
  long_tail_keywords: string[];
  schema_suggestions: Record<string, unknown>;
  engine: 'llm' | 'template';
}

export interface TagsResult {
  tags: string[];
  engine: 'llm' | 'template';
}

export interface FraudInput {
  orderId: string;
  userId?: string;
  email: string;
  phone: string;
  ipAddress?: string;
  totalAmount: number;
  paymentMethod: string;
  shippingAddress: Record<string, string>;
  items: Array<{ name?: string; quantity?: number; price?: number; productId?: string }>;
  userOrderHistory?: Array<{ total: number }>;
  isFirstOrder?: boolean;
  accountAgeDays?: number;
  billingMatchesShipping?: boolean;
}

export interface FraudResult {
  order_id: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  risk_factors: string[];
  recommended_action: 'approve' | 'additional_verification' | 'manual_review';
  user_verified: boolean;
  analyzed_at: string;
}

export interface InsightAlert {
  severity: 'info' | 'warning';
  title: string;
  message: string;
}

export interface InsightsResult {
  period_days: number;
  health_score: number;
  insights: string[];
  suggestions: string[];
  alerts: InsightAlert[];
  forecast: Array<{ date: string; revenue: number }> | null;
  generated_at: string;
}

export interface SearchSuggestion {
  type: 'product' | 'category' | 'query';
  text: string;
  score: number;
  id?: string;
  slug?: string;
}

export interface SuggestionResult {
  suggestions: SearchSuggestion[];
  didYouMean: string | null;
  correctedQuery: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  intent: string;
  answer: string;
  suggestions: string[];
  engine: 'llm' | 'rules' | 'catalog';
  timestamp: string;
}

export interface ModerationResult {
  sentiment: 'positive' | 'neutral' | 'negative';
  polarity: number;
  toxicity_score: number;
  flags: string[];
  recommended_action: 'approve' | 'review' | 'flag';
  product?: string;
  analyzed_at: string;
}

export interface ReviewSummaryResult {
  summary: string;
  summary_source: 'llm' | 'extractive';
  key_points: string[];
  sentiment_mix: Record<string, number>;
  average_rating?: number | null;
  generated_at: string;
}

export interface QuestionAnswerResult {
  answer: string;
  /** false when neither the LLM nor the rule engine can answer confidently */
  answerable: boolean;
  confidence: 'high' | 'medium' | 'low';
  engine: 'llm' | 'rules';
  generated_at: string;
}

export interface ReviewReplyResult {
  reply: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  engine: 'llm' | 'template';
  generated_at: string;
}

export interface RecoveryItemInput {
  name: string;
  quantity?: number;
  price?: number;
}

export interface RecoveryMessageResult {
  subject: string;
  message: string;
  engine: 'llm' | 'template';
  generated_at: string;
}

export interface CampaignCopyResult {
  email: { subject: string; body: string; cta: string };
  push: { title: string; body: string };
  sms: { body: string };
  engine: 'llm' | 'template';
  generated_at: string;
}

/** AI support-triage result (mirrors lib/ai/supportTriage result shape). */
export interface SupportTriageResult {
  ticketId?: string;
  category: string;
  priority: string;
  urgency: string;
  sentiment: string;
  isAbusive: boolean;
  shouldEscalate: boolean;
  suggestedSlaMinutes: number;
  suggestedTags: string[];
  draftReply: string;
  summary: string;
  engine: string;
  generated_at: string;
}

export interface BlogDraftResult {
  title: string;
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  outline: string[];
  sections: Array<{ heading: string; content: string }>;
  engine: 'llm' | 'template';
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Core transport
// ---------------------------------------------------------------------------

async function callAI<T>(path: string, body?: unknown, timeoutMs?: number): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? aiConfig.timeoutMs);

  try {
    const response = await fetch(`${aiConfig.baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn(`[AI] ${path} returned ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as { success: boolean; data?: T };
    if (!payload.success) return null;
    return payload.data ?? null;
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'AbortError'
        ? `timeout after ${timeoutMs ?? aiConfig.timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : 'unknown error';
    console.warn(`[AI] call to ${path} failed (${reason}) — using fallback`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// High-level typed helpers
// ---------------------------------------------------------------------------

export const ai = {
  health: () => callAI<{ status: string; engine: string; llm_provider: string | null; version: string }>('/health'),

  generateDescription: (input: DescriptionInput) =>
    callAI<DescriptionResult>('/api/generate-description', input),

  optimizeSEO: (input: SEOInput) => callAI<SEOResult>('/api/optimize-seo', input),

  generateTags: (input: { name: string; description?: string; category?: string; existingTags?: string[]; limit?: number }) =>
    callAI<TagsResult>('/api/generate-tags', {
      name: input.name,
      description: input.description,
      category: input.category,
      existing_tags: input.existingTags,
      limit: input.limit,
    }),

  recommendations: (input: RecommendationInput) =>
    callAI<RecommendationResult>('/api/recommendations', {
      user_id: input.userId,
      viewed_products: input.viewedProducts,
      purchased_products: input.purchasedProducts,
      cart_products: input.cartProducts,
      catalog: input.catalog.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category,
        category_id: p.categoryId,
        tags: p.tags,
        description: p.description,
        price: p.price,
        sales_count: p.salesCount,
        average_rating: p.averageRating,
        image: p.image,
      })),
      exclude_ids: input.excludeIds,
      limit: input.limit,
    }),

  detectFraud: (input: FraudInput) =>
    callAI<FraudResult>('/api/fraud-detection', {
      order_id: input.orderId,
      user_id: input.userId,
      email: input.email,
      phone: input.phone,
      ip_address: input.ipAddress || '',
      total_amount: input.totalAmount,
      payment_method: input.paymentMethod,
      shipping_address: input.shippingAddress,
      items: input.items,
      user_order_history: input.userOrderHistory,
      is_first_order: input.isFirstOrder,
      account_age_days: input.accountAgeDays,
      billing_matches_shipping: input.billingMatchesShipping,
    }),

  insights: (data: Record<string, unknown>, periodDays = 30, forecastDays = 7) =>
    callAI<InsightsResult>('/api/analytics-insights', {
      period_days: periodDays,
      data,
      forecast_days: forecastDays,
    }),

  searchSuggestions: (input: {
    q: string;
    products: Array<{ id: string; name: string; slug?: string; tags?: string[]; salesCount?: number }>;
    categories: Array<{ id: string; name: string; slug?: string }>;
    limit?: number;
  }) =>
    callAI<SuggestionResult>('/api/search-suggestions', {
      q: input.q,
      products: input.products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        tags: p.tags,
        sales_count: p.salesCount,
      })),
      categories: input.categories,
      limit: input.limit,
    }),

  chat: (input: { message: string; context?: Record<string, unknown>; catalog?: CatalogProductInput[] }) =>
    callAI<ChatResult>('/api/chat', input),

  moderateReview: (input: { text: string; rating?: number; productName?: string }) =>
    callAI<ModerationResult>('/api/moderation', {
      text: input.text,
      rating: input.rating,
      product_name: input.productName,
    }),

  summarizeReviews: (input: { productName: string; reviews: Array<{ comment: string; rating?: number }>; ratingBreakdown?: Record<string, unknown> }) =>
    callAI<ReviewSummaryResult>('/api/review-summary', {
      product_name: input.productName,
      reviews: input.reviews,
      rating_breakdown: input.ratingBreakdown,
    }),

  answerProductQuestion: (input: { question: string; product?: CatalogProductInput; catalog?: CatalogProductInput[] }) =>
    callAI<QuestionAnswerResult>('/api/answer-product-question', input),

  draftReviewReply: (input: { reviewText: string; rating?: number; productName?: string; customerName?: string }) =>
    callAI<ReviewReplyResult>('/api/review-reply', {
      review_text: input.reviewText,
      rating: input.rating,
      product_name: input.productName,
      customer_name: input.customerName,
    }),

  draftRecoveryMessage: (input: {
    customerName?: string;
    items: RecoveryItemInput[];
    cartValue?: number;
    hoursAbandoned?: number;
  }) =>
    callAI<RecoveryMessageResult>('/api/recovery-message', {
      customer_name: input.customerName,
      items: input.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
      cart_value: input.cartValue,
      hours_abandoned: input.hoursAbandoned,
    }),

  campaignCopy: (input: {
    productName?: string;
    offer?: string;
    audience?: string;
    channels: string[];
    tone: string;
    deadline?: string;
    market?: string;
  }) =>
    callAI<CampaignCopyResult>('/api/campaign-copy', {
      product_name: input.productName,
      offer: input.offer,
      audience: input.audience,
      channels: input.channels,
      tone: input.tone,
      deadline: input.deadline,
      market: input.market,
    }),

  blogDraft: (input: {
    topic: string;
    keywords?: string[];
    audience?: string;
    category?: string;
  }) =>
    callAI<BlogDraftResult>('/api/blog-draft', {
      topic: input.topic,
      keywords: input.keywords,
      audience: input.audience,
      category: input.category,
    }),
};

// ---------------------------------------------------------------------------
// Local fallback engines (used when the AI service is unreachable)
// ---------------------------------------------------------------------------

/** Deterministic in-app recommendation fallback — category affinity + popularity. */
export async function localRecommendations(input: RecommendationInput): Promise<RecommendationResult> {
  const catalog = input.catalog;
  const exclude = new Set(input.excludeIds || []);
  const signalIds = new Set([
    ...(input.purchasedProducts || []),
    ...(input.cartProducts || []),
    ...(input.viewedProducts || []),
  ]);

  const categoryCounts = new Map<string, number>();
  for (const pid of signalIds) {
    const product = catalog.find((p) => p.id === pid);
    if (product?.category) {
      categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);
    }
  }

  const scored = catalog
    .filter((p) => !exclude.has(p.id) && !signalIds.has(p.id))
    .map((p) => {
      let score = 0;
      if (categoryCounts.size > 0) {
        score += (categoryCounts.get(p.category || '') || 0) * 0.4;
      }
      score += Math.min(1, (p.averageRating || 0) / 5) * 0.3;
      score += Math.min(1, Math.log10((p.salesCount || 0) + 1) / 3) * 0.3;
      return { product: p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit || 8);

  return {
    recommendations: scored.map((s) => ({
      productId: s.product.id,
      score: Math.round(s.score * 100) / 100,
      reason: categoryCounts.get(s.product.category || '')
        ? 'Popular in categories you browse'
        : 'Popular among customers',
    })),
    strategy: 'local_fallback',
    reasons: {},
  };
}

/** Deterministic in-app insights fallback derived from raw aggregates. */
export function localInsights(data: Record<string, unknown>, periodDays = 30): InsightsResult {
  const insights: string[] = [];
  const suggestions: string[] = [];
  const alerts: InsightAlert[] = [];

  const revenueByDay = (data.revenueByDay as Array<{ date: string; revenue: number }>) || [];
  if (revenueByDay.length > 1) {
    const values = revenueByDay.map((d) => d.revenue);
    const first = values[0] || 0;
    const last = values[values.length - 1] || 0;
    const growth = first > 0 ? ((last - first) / first) * 100 : 0;
    insights.push(
      growth >= 0
        ? `Revenue ${growth.toFixed(1)}% vs period start (local estimate)`
        : `Revenue down ${Math.abs(growth).toFixed(1)}% vs period start`
    );
  }

  const lowStock = (data.lowStockProducts as number) || 0;
  if (lowStock > 0) {
    alerts.push({
      severity: 'warning',
      title: `${lowStock} products low on stock`,
      message: 'Restock soon to avoid missed sales',
    });
  }

  const top = ((data.topProducts as Array<{ name: string }>) || [])[0];
  if (top?.name) {
    insights.push(`Top seller: ${top.name}`);
  }

  return {
    period_days: periodDays,
    health_score: alerts.length > 0 ? 85 : 95,
    insights: insights.slice(0, 4),
    suggestions,
    alerts: alerts.slice(0, 4),
    forecast: null,
    generated_at: new Date().toISOString(),
  };
}

/** Simple in-app token edit for text search harness — returns token overlap suggestions. */
export function localSearchSuggestions(input: { q: string; products: Array<{ id: string; name: string; slug?: string; tags?: string[]; salesCount?: number }>; limit?: number }): SuggestionResult {
  const q = input.q.trim().toLowerCase();
  const suggestions: SearchSuggestion[] = [];
  if (!q) return { suggestions: [], didYouMean: null, correctedQuery: null };

  for (const p of input.products.slice(0, 100)) {
    const name = p.name.toLowerCase();
    if (name.startsWith(q) || name.includes(q)) {
      suggestions.push({ type: 'product', text: p.name, score: 0.8, id: p.id, slug: p.slug });
      if (suggestions.length >= (input.limit || 8)) break;
    }
  }

  return { suggestions, didYouMean: null, correctedQuery: null };
}

// ---------------------------------------------------------------------------
// Local content-generation engines (description / SEO / tags)
// Used when the AI microservice is unreachable so admin tools always work.
// ---------------------------------------------------------------------------

const GENERIC_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'by', 'from',
  'premium', 'quality', 'best', 'new', 'real', 'genuine', 'original', 'brand', 'top',
  'super', 'ultra', 'pro', 'plus', 'ultimate', 'high',
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 1);
}

/** Deterministic description generator — template with market/audience flavor. */
export function localGenerateDescription(input: DescriptionInput): DescriptionResult {
  const { name, category, features = [], price, brand, targetAudience, tone = 'professional', style = 'standard', market = 'Bangladesh' } = input;

  const cat = category && category !== 'General' ? category.toLowerCase() : 'product';
  const brandLabel = brand ? `${brand} ` : '';
  const audience = targetAudience
    ? `Designed with ${targetAudience.toLowerCase()} in mind`
    : `Built for everyday use`;

  const featurePts = features
    .map((f) => f.trim())
    .filter(Boolean)
    .slice(0, 6);

  const featureLines = featurePts
    .map(
      (f, i) =>
        `${i + 1}. ${f.charAt(0).toUpperCase() + f.slice(1)} — a standout reason to choose the ${name}.`
    )
    .join('\n');

  const priceLine = price
    ? `At an honest price of ৳${price.toLocaleString('en-IN')}, it delivers dependable performance without the premium markup.`
    : `It offers dependable performance at a fair price.`;

  const shortDescription = `${name} — ${cat} essentials. ${featureLines ? featurePts[0] + '.' : 'A reliable everyday choice.'}`;

  let fullDescription = '';
  if (style === 'concise') {
    fullDescription = `${name}: ${cat} made right. ${featureLines ? featurePts.join(', ') + '.' : ''} ${priceLine} Available with fast delivery across ${market}.`;
  } else if (style === 'detailed') {
    fullDescription = [
      `The ${brandLabel}${name} is a thoughtfully made ${cat} designed to last. ${audience}, and the build quality shows it from the moment you unbox it.`,
      featureLines ? `Key highlights:\n${featureLines}` : '',
      priceLine,
      `Order today and enjoy reliable nationwide delivery and easy returns across ${market}.`,
    ]
      .filter(Boolean)
      .join('\n\n');
  } else {
    fullDescription = [
      `Bring home the ${brandLabel}${name} — a ${cat} that balances durability, style, and value. ${audience}.`,
      featureLines ? `Highlights include:\n${featureLines}` : '',
      priceLine,
      `${tone === 'luxury' ? 'A premium addition to your collection.' : 'A dependable daily companion.'} Shop now with fast shipping in ${market}.`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return {
    short_description: shortDescription,
    full_description: fullDescription,
    engine: 'template',
    generated_at: new Date().toISOString(),
  };
}

/** Deterministic SEO optimizer — keyword-rich title/description metadata. */
export function localOptimizeSEO(input: SEOInput): SEOResult {
  const { title, description, category, keywords = [] } = input;

  const titleWords = tokenize(title).filter((w) => !GENERIC_WORDS.has(w));
  const catTokens = category && category !== 'General' ? tokenize(category) : [];
  const baseKeywords = [...new Set([...titleWords, ...catTokens, ...tokenize(keywords.join(' '))])];

  const metaTitle = `${title} | Buy in Bangladesh - Free Delivery`;
  const metaDescription =
    (description || `Shop ${title.toLowerCase()}.`).slice(0, 150) +
    ' Order online with fast delivery across Bangladesh.';

  const longTail = [
    `buy ${title.toLowerCase()} online`,
    `${title.toLowerCase()} price in bangladesh`,
    `best ${title.toLowerCase()} deals dhaka`,
    ...baseKeywords
      .slice(0, 4)
      .map((k) => `affordable ${k} in bangladesh`),
  ];

  return {
    meta_title: metaTitle,
    meta_description: metaDescription,
    keywords: [...new Set(['bangladesh', 'online shopping', 'free delivery', ...baseKeywords])].slice(0, 12),
    long_tail_keywords: [...new Set(longTail)].slice(0, 8),
    schema_suggestions: {
      '@type': 'Product',
      name: title,
      category,
      offers: { '@type': 'Offer', priceCurrency: 'BDT', availability: 'https://schema.org/InStock' },
    },
    engine: 'template',
  };
}

/** Deterministic tag generator — keyword extraction with curated fallbacks. */
export function localGenerateTags(input: {
  name: string;
  description?: string;
  category?: string;
  existingTags?: string[];
  limit?: number;
}): TagsResult {
  const { name, description = '', category, existingTags = [], limit = 8 } = input;

  const fromName = tokenize(name).filter((w) => !GENERIC_WORDS.has(w) && w.length >= 3);
  const fromDesc = tokenize(description)
    .filter((w) => !GENERIC_WORDS.has(w) && w.length >= 3)
    .slice(0, 10);
  const catTokens = category && category !== 'General' ? tokenize(category) : [];
  const curated = ['bangladesh', 'dhaka', 'online shopping', 'free delivery'];

  const tags = [
    ...new Set([
      ...catTokens,
      ...fromName,
      ...fromDesc,
      ...existingTags.map((t) => t.toLowerCase()),
      ...curated,
    ]),
  ].slice(0, limit);

  return { tags, engine: 'template' };
}

/**
 * Deterministic fraud screener — scores an order from transaction signals alone.
 * Used when the AI microservice is unreachable so checkout never depends on it.
 */
export function localFraudDetection(input: FraudInput): FraudResult {
  const factors: string[] = [];
  let score = 0;

  const {
    orderId,
    email,
    phone,
    totalAmount,
    paymentMethod,
    shippingAddress,
    items = [],
    userOrderHistory = [],
    isFirstOrder,
    accountAgeDays,
    billingMatchesShipping,
  } = input;

  const cod = paymentMethod === 'cod';
  const guest = !input.userId;
  const pastTotal = userOrderHistory.reduce((sum, o) => sum + (o.total || 0), 0);

  // 1. Cash-on-delivery on a large order (no money at stake for fraudster)
  if (cod && totalAmount > 25000) {
    score += 30;
    factors.push(`Large COD order (৳${Math.round(totalAmount).toLocaleString('en-IN')})`);
  } else if (cod && totalAmount > 10000) {
    score += 15;
    factors.push(`COD order above ৳10,000`);
  }

  // 2. Fresh account + first order
  if (isFirstOrder === true && accountAgeDays !== undefined && accountAgeDays <= 14) {
    score += 20;
    factors.push(`First order from an account created ${accountAgeDays}d ago`);
  } else if (isFirstOrder === true) {
    score += 10;
    factors.push('First order for this account');
  }

  // 3. Guest checkout with COD
  if (guest && cod) {
    score += 10;
    factors.push('Guest checkout with cash on delivery');
  }

  // 4. Billing mismatch
  if (billingMatchesShipping === false) {
    score += 10;
    factors.push('Billing address differs from shipping address');
  }

  // 5. Unusual quantity of a single line
  const maxQty = Math.max(0, ...items.map((i) => i.quantity || 0));
  if (maxQty >= 10) {
    score += 10;
    factors.push(`Unusual quantity (${maxQty}) of a single item`);
  }

  // 6. Phone/email sanity
  if (!phone || phone.replace(/\D/g, '').length < 10) {
    score += 10;
    factors.push('Invalid or missing phone number');
  }
  if (!email || !email.includes('@')) {
    score += 10;
    factors.push('Invalid or missing email address');
  }

  // 7. Established customer with real history reduces risk
  if (userOrderHistory.length >= 3) {
    score -= 15;
    factors.push(`Established customer (${userOrderHistory.length} past orders)`);
  }
  if (pastTotal > 20000) {
    score -= 5;
    factors.push(`Returning customer with ৳${Math.round(pastTotal).toLocaleString('en-IN')} in past orders`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const risk_level: FraudResult['risk_level'] = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  const recommended_action: FraudResult['recommended_action'] =
    risk_level === 'high' ? 'manual_review' : risk_level === 'medium' ? 'additional_verification' : 'approve';

  // Contract: risk_score is normalized 0..1 (matches the Python service)
  return {
    order_id: orderId,
    risk_score: parseFloat((score / 100).toFixed(2)),
    risk_level,
    risk_factors: factors,
    recommended_action,
    user_verified: risk_level === 'low',
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * Deterministic FAQ chatbot — mirrors the Python service's rule intents so the
 * storefront assistant keeps answering when the AI service is unreachable.
 * Supports catalog lookups via lightweight token overlap matching.
 */
const FAQ_INTENTS: Array<{
  intent: string;
  keywords: string[];
  answer: string;
  suggestions: string[];
}> = [
  {
    intent: 'shipping',
    keywords: ['ship', 'shipping', 'deliver', 'delivery', 'courier', 'parcel', 'receive', 'arrive', 'arrival', 'charge', 'fee', 'cost'],
    answer: "We deliver across all 64 districts of Bangladesh. Standard delivery takes 2-5 working days (৳80, free over ৳3,000) and express delivery takes 1-2 days (৳150). You'll get a tracking link once your order ships.",
    suggestions: ['How much is shipping?', 'What are delivery times?', 'Track my order'],
  },
  {
    intent: 'return',
    keywords: ['return', 'refund', 'exchange', 'replace', 'money back', 'defective', 'damaged', 'broken'],
    answer: "You can return any item within 7 days of delivery if it's unused, in original packaging, and has its tags. Refunds are processed within 3-5 working days after we receive the returned item. Contact support with your order number to start a return.",
    suggestions: ['How do I return an item?', 'Refund status'],
  },
  {
    intent: 'payment',
    keywords: ['pay', 'payment', 'bkash', 'nagad', 'ssl', 'card', 'credit', 'debit', 'cod', 'cash on delivery', 'bank', 'online'],
    answer: 'We accept Cash on Delivery (COD), bKash, Nagad, SSLCOMMERZ (cards/internet banking), and bank transfer. All online payments are processed securely — we never store your card details.',
    suggestions: ['Pay with bKash', 'Is COD available?'],
  },
  {
    intent: 'order_status',
    keywords: ['order', 'status', 'track', 'tracking', 'where is my', 'shipped', 'processing', 'confirm'],
    answer: "You can track your order anytime from your account under 'My Orders'. Order statuses include: pending → confirmed → processing → packed → shipped → out for delivery → delivered. If you need help, reply with your order number and we'll look into it.",
    suggestions: ['Where is my order?', 'Cancel my order'],
  },
  {
    intent: 'cancel',
    keywords: ['cancel', 'cancellation'],
    answer: "You can cancel an order free of charge while it's pending, confirmed, or processing — just open the order in 'My Orders' and hit cancel, or contact support. Once an order ships, it can no longer be cancelled, but you can start a return after delivery.",
    suggestions: ['How do I cancel?', 'Return policy'],
  },
  {
    intent: 'product',
    keywords: ['product', 'size', 'color', 'variant', 'specification', 'spec', 'material', 'quality', 'how to use', 'compatible', 'stock', 'available'],
    answer: 'Each product page lists full specifications, available variants (size/color), stock status, and verified customer reviews. If the variant you want shows out of stock, tap the notification bell to get an instant alert when it\'s back.',
    suggestions: ['Is it in stock?', 'Check product details'],
  },
  {
    intent: 'support_contact',
    keywords: ['contact', 'support', 'help', 'agent', 'human', 'call', 'phone', 'email', 'whatsapp'],
    answer: 'Our team is available 7 days a week, 9AM-9PM: call +880 1700 000 000, email support@pakistannoor.com, or open a support ticket from your account. We typically reply within a few hours.',
    suggestions: ['Open a support ticket', 'Call support'],
  },
  {
    intent: 'loyalty',
    keywords: ['loyalty', 'points', 'reward', 'referral', 'discount', 'coupon', 'promo', 'voucher'],
    answer: 'You earn loyalty points on every purchase (1 point per ৳100 spent) redeemable at checkout. You also get a unique referral code in your account — share it to earn bonus points when friends order.',
    suggestions: ['How do loyalty points work?', 'My referral code'],
  },
  {
    intent: 'account',
    keywords: ['login', 'log in', 'sign in', 'password', 'register', 'account', 'profile', 'verify', 'otp'],
    answer: "You can register or sign in from the top-right menu. If you forgot your password, use the 'Forgot password' link on the login page. Account questions can also be solved via support@pakistannoor.com.",
    suggestions: ['Reset my password', 'Create an account'],
  },
  {
    intent: 'greeting',
    keywords: ['hi', 'hello', 'hey', 'salam', 'assalam', 'good morning', 'good evening', 'good afternoon'],
    answer: 'Hello! 👋 Welcome to Pakistani Noor. I can help you with orders, shipping, returns, payments, and products. What would you like to know?',
    suggestions: ['Track my order', 'Shipping info', 'Return policy'],
  },
  {
    intent: 'thanks',
    keywords: ['thank', 'thanks', 'great', 'awesome', 'helpful', 'appreciate'],
    answer: 'You\'re very welcome! 😊 Is there anything else I can help you with?',
    suggestions: ['Shipping info', 'Return policy'],
  },
  {
    intent: 'bye',
    keywords: ['bye', 'goodbye', 'see you', 'later'],
    answer: 'Goodbye! Thanks for visiting Pakistani Noor. Have a wonderful day! 👋',
    suggestions: ['Shipping info', 'Track my order'],
  },
];

/** Normalizes text for intent matching: lowercase, strip punctuation/emoji. */
function normalizeChatText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ')
    .replace(/[^a-z0-9\s৳]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lightweight fuzzy product-name match (token overlap ratio). */
function bestCatalogMatch(
  message: string,
  catalog: CatalogProductInput[]
): CatalogProductInput | null {
  const msgTokens = new Set(normalizeChatText(message).split(' ').filter((t) => t.length >= 3));
  if (msgTokens.size === 0) return null;

  let best: CatalogProductInput | null = null;
  let bestScore = 0;
  for (const product of catalog) {
    const nameTokens = new Set(normalizeChatText(product.name).split(' ').filter((t) => t.length >= 3));
    let overlap = 0;
    nameTokens.forEach((t) => {
      if (msgTokens.has(t)) overlap += 1;
    });
    const sim = overlap / Math.max(1, Math.min(nameTokens.size, msgTokens.size));
    if (sim > bestScore) {
      bestScore = sim;
      best = product;
    }
  }
  return bestScore >= 0.45 ? best : null;
}

export function localFAQChat(input: {
  message: string;
  context?: Record<string, unknown>;
  catalog?: CatalogProductInput[];
}): ChatResult {
  const message = normalizeChatText(input.message);
  const context = input.context || {};
  const now = new Date().toISOString();

  // Rule intents
  let bestIntent: (typeof FAQ_INTENTS)[number] | null = null;
  let bestScore = 0;
  for (const entry of FAQ_INTENTS) {
    const score = entry.keywords.reduce((acc, keyword) => (message.includes(keyword) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = entry;
    }
  }

  if (bestIntent && bestScore > 0) {
    let answer = bestIntent.answer;
    if (bestIntent.intent === 'order_status' && context && typeof context.orderNumber === 'string') {
      answer = `For order ${context.orderNumber}: you can check its latest status anytime in 'My Orders'. If it's marked delivered but hasn't arrived, let us know and we'll chase the courier.`;
    }
    return { intent: bestIntent.intent, answer, suggestions: bestIntent.suggestions, engine: 'rules', timestamp: now };
  }

  // Catalog-aware fallback
  if (input.catalog && input.catalog.length > 0 && message.length >= 3) {
    const match = bestCatalogMatch(message, input.catalog);
    if (match) {
      const price = match.price != null ? `৳${match.price.toLocaleString('en-IN')}` : '—';
      const rating = match.averageRating != null ? `, rated ${match.averageRating.toFixed(1)}/5` : '';
      return {
        intent: 'product_lookup',
        answer: `I found '${match.name}' (${price}${rating}). Want me to take you to its page, or would you like to know more about it?`,
        suggestions: [`Tell me about ${match.name}`, 'Shipping info'],
        engine: 'catalog',
        timestamp: now,
      };
    }
  }

  return {
    intent: 'fallback',
    answer:
      "I'm not sure I caught that. 😅 I can help with orders, shipping, returns, payments, loyalty points, and products. Could you rephrase, or choose one of these?",
    suggestions: ['Track my order', 'Shipping info', 'Return policy', 'How do loyalty points work?'],
    engine: 'rules',
    timestamp: now,
  };
}

/**
 * Deterministic product Q&A fallback — mirrors the Python service's factual
 * rule engine exactly (price / stock / delivery / returns / payment / warranty).
 * Product-specific questions (sizes, compatibility, usage…) are intentionally
 * left unanswered (`answerable: false`) so they reach the admin queue.
 */
export function localAnswerProductQuestion(input: {
  question: string;
  product?: CatalogProductInput;
  catalog?: CatalogProductInput[];
}): QuestionAnswerResult {
  const now = new Date().toISOString();
  const q = normalizeChatText(input.question);
  const product = input.product;

  if (!product) {
    return {
      answer: '',
      answerable: false,
      confidence: 'low',
      engine: 'rules',
      generated_at: now,
    };
  }

  const has = (...keys: string[]) => keys.some((k) => q.includes(k));

  const priceText = product.price != null ? `৳${product.price.toLocaleString('en-IN')}` : '';
  const inStock = product.stock == null || product.stock > 0;
  const stockText = product.stock != null ? `${product.stock} units in stock` : 'in stock';

  let answer = '';
  let answerable = false;

  if (has('price', 'cost', 'how much', 'expensive', 'cheap')) {
    answer = `The price of ${product.name} is ${priceText}. Keep an eye on the listing page for occasional flash deals and coupons.`;
    answerable = true;
  } else if (has('stock', 'available', 'in stock', 'out of stock', 'back in stock', 'restock')) {
    answer = inStock
      ? `${product.name} is currently ${stockText}.`
      : `${product.name} is currently out of stock. Tap the notification bell on the product page to get an instant alert when it's back.`;
    answerable = true;
  } else if (has('shipping', 'delivery', 'deliver', 'ship', 'arrive', 'courier')) {
    answer = `${product.name} ships anywhere in Bangladesh. Standard delivery takes 2-5 working days (৳80, free over ৳3,000) and express takes 1-2 days (৳150). You get a tracking link once the order ships.`;
    answerable = true;
  } else if (has('return', 'refund', 'exchange', 'returnable', 'money back')) {
    answer = "You can return this item within 7 days of delivery if it's unused, in original packaging, and has its tags. Refunds are processed within 3-5 working days after we receive it.";
    answerable = true;
  } else if (has('payment', 'pay', 'bkash', 'nagad', 'card', 'cod', 'cash on delivery', 'bank')) {
    answer = "We accept Cash on Delivery (COD), bKash, Nagad, SSLCOMMERZ (cards/internet banking), and bank transfer. Online payments are fully secure — we never store card details.";
    answerable = true;
  } else if (has('warranty', 'guarantee', 'defective', 'damaged', 'broken')) {
    answer = "Check the product listing for warranty details. If anything arrives damaged or defective, our 7-day return policy and support team will sort it out quickly.";
    answerable = true;
  }

  return {
    answer,
    answerable,
    confidence: answerable ? 'medium' : 'low',
    engine: 'rules',
    generated_at: now,
  };
}

/**
 * Deterministic seller-review reply fallback — mirrors the Python service's
 * templated drafts keyed on sentiment (rating + keyword signals). Used when
 * the AI microservice is unreachable so the admin reply tool always works.
 */
export function localDraftReviewReply(input: {
  reviewText: string;
  rating?: number;
  productName?: string;
  customerName?: string;
}): ReviewReplyResult {
  const text = (input.reviewText || '').trim();
  const low = text.toLowerCase();

  const pos = [...REVIEW_POSITIVE_WORDS].filter((w) => low.includes(w)).length;
  const neg = [...REVIEW_NEGATIVE_WORDS].filter((w) => low.includes(w)).length;
  let sentiment: ReviewReplyResult['sentiment'] =
    pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';
  if (input.rating) {
    if (input.rating >= 4 && sentiment === 'neutral') sentiment = 'positive';
    else if (input.rating <= 2 && sentiment === 'neutral') sentiment = 'negative';
  }
  if (sentiment === 'neutral') sentiment = 'positive'; // friendly default

  let reply: string;
  if (sentiment === 'negative') {
    reply =
      "Thank you for your honest feedback — we're sorry your experience fell short of expectations. We take this seriously and want to make it right: please reach out at support@pakistannoor.com or reply here with your order number, and our team will sort out a replacement, return, or refund as quickly as possible.";
  } else if (sentiment === 'positive') {
    reply =
      "Thank you so much for your wonderful review! We're thrilled the product worked out for you. We truly appreciate your support and look forward to serving you again — do check our new arrivals for more great finds.";
  } else {
    reply =
      "Thanks for taking the time to share your feedback — it really helps us improve. If there's anything we can do to make your experience even better, just reach out to support@pakistannoor.com and we'll be happy to help.";
  }

  return {
    reply,
    sentiment,
    engine: 'template',
    generated_at: new Date().toISOString(),
  };
}

/**
 * Deterministic abandoned-cart recovery message — mirrors the Python service's
 * templated draft: names the customer, lists the items left behind, and nudges
 * with a friendly call-to-action. Used when the microservice is unreachable.
 */
export function localDraftRecoveryMessage(input: {
  customerName?: string;
  items: RecoveryItemInput[];
  cartValue?: number;
  hoursAbandoned?: number;
}): RecoveryMessageResult {
  const name = (input.customerName || '').trim() || 'there';
  const items = (input.items || []).filter((i) => (i.name || '').trim());
  const itemLines = items
    .slice(0, 3)
    .map((i) => i.name.trim())
    .join(', ');
  const valueText =
    input.cartValue != null
      ? `৳${input.cartValue.toLocaleString('en-IN')}`
      : 'the items you picked';

  let message =
    `Hi ${name}, you left some goodies in your cart and we wanted to make sure they didn't slip your mind: ` +
    `${itemLines}${items.length > 3 ? '…' : ''} (total ${valueText}). `;
  message +=
    'Your items are still reserved — order today and enjoy fast delivery across Bangladesh with easy 7-day returns. [Tap here to return to your cart] and finish checking out whenever you\u2019re ready. \uD83D\uDE0A';

  return {
    subject: 'Your cart is still waiting 🛒',
    message,
    engine: 'template',
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Review intelligence fallbacks (mirror the Python service's signals)
// ---------------------------------------------------------------------------

const REVIEW_POSITIVE_WORDS = new Set([
  'good', 'great', 'excellent', 'amazing', 'awesome', 'love', 'loved', 'perfect',
  'beautiful', 'nice', 'satisfied', 'happy', 'pleased', 'recommend', 'recommended',
  'superb', 'fantastic', 'wonderful', 'brilliant', 'outstanding', 'impressive',
  'quality', 'fast', 'quick', 'responsive', 'worth', 'value', 'durable', 'comfortable',
  'soft', 'stylish', 'gorgeous', 'delicious', 'fresh', 'clean', 'helpful',
]);

const REVIEW_NEGATIVE_WORDS = new Set([
  'bad', 'poor', 'terrible', 'awful', 'worst', 'waste', 'disappointed', 'disappointing',
  'hate', 'hated', 'broken', 'break', 'damaged', 'defective', 'useless', 'cheap',
  'fake', 'fraud', 'scam', 'stale', 'slow', 'late', 'delay', 'never', 'nothing',
  'wrong', 'misleading', 'crap', 'horrible', 'pathetic',
]);

const REVIEW_TOXIC_WORDS = new Set([
  'stupid', 'idiot', 'moron', 'dumb', 'ugly', 'hate', 'kill', 'suck', 'sucks',
  'fool', 'jerk', 'fraud', 'scam', 'liar', 'cheat', 'cheated', 'traitor', 'slave',
  'shut', 'trash', 'garbage', 'pathetic', 'useless',
]);

export function localModeration(input: {
  text: string;
  rating?: number;
  productName?: string;
}): ModerationResult {
  const text = (input.text || '').trim();
  const low = text.toLowerCase();

  const flagged = [...REVIEW_TOXIC_WORDS].filter((w) => low.includes(w));
  const punctuationHits = (text.match(/!{3,}/g) || []).length + (text.match(/\?{3,}/g) || []).length;
  const toxicity = Math.min(1, (flagged.length * 0.45 + punctuationHits * 0.05) / 1);

  const tokens = textTokens(text);
  const positive = tokens.filter((t) => REVIEW_POSITIVE_WORDS.has(t)).length;
  const negative = tokens.filter((t) => REVIEW_NEGATIVE_WORDS.has(t)).length;
  const total = Math.max(positive + negative, 1);

  let sentiment: ModerationResult['sentiment'] = positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral';
  const polarity =
    sentiment === 'positive'
      ? Math.round((positive / total) * 100) / 100
      : sentiment === 'negative'
      ? -Math.round((negative / total) * 100) / 100
      : 0;

  if (input.rating) {
    const ratingSignal = input.rating >= 4 ? 'positive' : input.rating <= 2 ? 'negative' : 'neutral';
    if (sentiment === 'neutral') sentiment = ratingSignal;
  }

  const recommended_action: ModerationResult['recommended_action'] =
    toxicity >= 0.5 || (sentiment === 'negative' && input.rating != null && input.rating >= 4)
      ? 'flag'
      : toxicity >= 0.25
      ? 'review'
      : 'approve';

  return {
    sentiment,
    polarity,
    toxicity_score: Math.round(toxicity * 100) / 100,
    flags: flagged.slice(0, 5),
    recommended_action,
    product: input.productName,
    analyzed_at: new Date().toISOString(),
  };
}

export function localReviewSummary(input: {
  productName: string;
  reviews: Array<{ comment: string; rating?: number }>;
  ratingBreakdown?: Record<string, unknown>;
}): ReviewSummaryResult {
  const reviews = (input.reviews || []).filter((r) => (r.comment || '').trim().length > 0);
  const generated_at = new Date().toISOString();

  if (reviews.length === 0) {
    return {
      summary: `No customer reviews yet for ${input.productName}.`,
      summary_source: 'extractive',
      key_points: [],
      sentiment_mix: {},
      generated_at,
    };
  }

  // TF scoring across sentences (extractive summarization)
  const tokenFreq = new Map<string, number>();
  reviews.forEach((r) => textTokens(r.comment).forEach((t) => tokenFreq.set(t, (tokenFreq.get(t) || 0) + 1)));

  interface ScoredSentence {
    text: string;
    score: number;
    rating?: number;
  }
  const sentences: ScoredSentence[] = [];
  for (const review of reviews) {
    for (const part of review.comment.split(/(?<=[.!?])\s+/)) {
      const sentence = part.trim();
      const st = textTokens(sentence);
      if (st.length < 4) continue;
      const score = st.reduce((acc, w) => acc + (tokenFreq.get(w) || 0), 0) / Math.max(st.length, 1);
      sentences.push({ text: sentence, score, rating: review.rating });
    }
  }

  sentences.sort((a, b) => b.score - a.score);
  const key_points = sentences.slice(0, 4).map((s) => s.text.slice(0, 160));

  const grouped: Record<'positive' | 'neutral' | 'negative', string[]> = { positive: [], neutral: [], negative: [] };
  for (const s of sentences) {
    const pos = textTokens(s.text).filter((t) => REVIEW_POSITIVE_WORDS.has(t)).length;
    const neg = textTokens(s.text).filter((t) => REVIEW_NEGATIVE_WORDS.has(t)).length;
    grouped[pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral'].push(s.text.slice(0, 160));
  }

  const sentiment_mix: Record<string, number> = {
    positive: grouped.positive.length,
    neutral: grouped.neutral.length,
    negative: grouped.negative.length,
  };

  const ratings = reviews.map((r) => r.rating).filter((r): r is number => typeof r === 'number');
  const average_rating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  const summary = `Customers rate ${input.productName} an average of ${average_rating ?? '—'}/5 from ${reviews.length} reviews. Themes from reviews: ${key_points.slice(0, 3).join('; ') || 'not enough detail to extract themes yet'}.`;

  return {
    summary,
    summary_source: 'extractive',
    key_points,
    sentiment_mix,
    average_rating,
    generated_at,
  };
}

/** Lowercase alphanumeric tokens, dropping 1-2 char atoms (mirrors service tokenize). */
function textTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2);
}

export default ai;