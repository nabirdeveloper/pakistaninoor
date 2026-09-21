/**
 * AI Content Studio (Phase 3)
 * ===========================
 * Marketing content generation for the admin:
 *
 *   1. Campaign copy — email / push / SMS drafts for a product or offer,
 *      with tone control (friendly, professional, urgent, celebratory).
 *   2. Blog post drafts — title, slug, excerpt, SEO meta, outline and
 *      ready-to-edit body sections from a topic + keywords.
 *
 * Deterministic template engine. Mirrored by the Python service which
 * upgrades to LLM output when OPENAI_API_KEY / ANTHROPIC_API_KEY is set.
 */

export type CampaignTone = 'friendly' | 'professional' | 'urgent' | 'celebratory';
export type CampaignChannel = 'email' | 'push' | 'sms';

export interface CampaignCopyInput {
  productName?: string;
  offer?: string;
  audience?: string;
  channels: CampaignChannel[];
  tone: CampaignTone;
  deadline?: string;
  market?: string;
}

export interface CampaignEmailCopy {
  subject: string;
  body: string;
  cta: string;
}

export interface CampaignCopyResult {
  email: CampaignEmailCopy;
  push: { title: string; body: string };
  sms: { body: string };
  engine: 'llm' | 'template';
  generated_at: string;
}

export interface BlogDraftInput {
  topic: string;
  keywords?: string[];
  audience?: string;
  category?: string;
}

export interface BlogSection {
  heading: string;
  content: string;
}

export interface BlogDraftResult {
  title: string;
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  outline: string[];
  sections: BlogSection[];
  engine: 'llm' | 'template';
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const HOME_CTA = 'Shop on pakistannoor.com';
const DELIVERY_LINE = 'Free nationwide delivery on orders over ৳3,000, with easy 7-day returns.';

function taka(value: number): string {
  return `৳${value.toLocaleString('en-IN')}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ---------------------------------------------------------------------------
// Campaign copy — deterministic template engine
// ---------------------------------------------------------------------------

const TONE_OPENERS: Record<CampaignTone, { subject: string; pushTitle: string; body: string }> = {
  friendly: {
    subject: '{product} is waiting for you 🛍️',
    pushTitle: 'For you: {product} 🛍️',
    body: 'Hey there! We spotted something we think you will love — {product}.',
  },
  professional: {
    subject: '{product} — now available at Pakistani Noor',
    pushTitle: '{product} — new offer',
    body: 'Dear customer, we are pleased to introduce {product} at Pakistani Noor.',
  },
  urgent: {
    subject: 'Last chance: {offer} on {product} ⏰',
    pushTitle: '⏰ {offer} ends soon!',
    body: 'Hurry — {offer} on {product} is about to end.',
  },
  celebratory: {
    subject: '🎉 {offer} celebration on {product}',
    pushTitle: '🎉 {offer} — celebrate with us!',
    body: 'Great news! We are celebrating with an exclusive {offer} on {product}.',
  },
};

const TONE_CLOSERS: Record<CampaignTone, string> = {
  friendly: "We'd love to see your order soon — happy shopping! 😊",
  professional: 'We look forward to serving you. Thank you for choosing Pakistani Noor.',
  urgent: 'Don\u2019t miss out — stock is limited and this offer will not last.',
  celebratory: 'A perfect chance to treat yourself or someone special. Cheers! 🎉',
};

export function generateCampaignCopy(input: CampaignCopyInput): CampaignCopyResult {
  const {
    productName = 'your favourite picks',
    offer = 'an exclusive offer',
    audience = 'you',
    channels = ['email', 'push', 'sms'],
    tone = 'friendly',
    deadline,
    market = 'Bangladesh',
  } = input;

  const opener = TONE_OPENERS[tone];
  const closer = TONE_CLOSERS[tone];

  const subject = opener.subject
    .replaceAll('{product}', productName)
    .replaceAll('{offer}', offer);

  const pushTitle = opener.pushTitle
    .replaceAll('{product}', productName)
    .replaceAll('{offer}', offer);

  const deadlineLine = deadline ? ` Runs ${deadline} only.` : '';

  const emailBody = [
    opener.body.replaceAll('{product}', productName).replaceAll('{offer}', offer),
    '',
    `Don't miss ${offer ? `this ${offer}` : 'this offer'} — a thoughtful pick for ${audience}.`,
    ...(productName && productName !== 'your favourite picks'
      ? ['', `Why shoppers love it: quality you can trust, prices that stay fair, and delivery that keeps its promise anywhere in ${market}.`]
      : []),
    '',
    `${closer}`,
    '',
    DELIVERY_LINE.replace('nationwide', 'across Bangladesh') + deadlineLine,
  ].join('\n');

  const pushBody = `${opener.body.replaceAll('{product}', productName).replaceAll('{offer}', offer)} Tap to browse before it is gone.${deadlineLine}`;

  const smsBody =
    tone === 'urgent'
      ? `${offer.toUpperCase()} on ${productName}! ${deadlineLine} Order now: pakistannoor.com — COD available.`
      : `${tone === 'celebratory' ? '🎉 ' : ''}${offer} on ${productName}! Shop now: pakistannoor.com. ${tone === 'friendly' ? 'We saved it just for you 😊' : 'Fast delivery & easy returns.'} COD available.`;

  return {
    email: {
      subject,
      body: emailBody,
      cta: `${HOME_CTA}${productName !== 'your favourite picks' ? `/products/${slugify(productName)}` : ''}`,
    },
    push: {
      title: pushTitle,
      body: pushBody,
    },
    sms: { body: smsBody },
    engine: 'template',
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Blog draft — deterministic template engine
// ---------------------------------------------------------------------------

/**
 * Deterministic blog draft builder: topic + keywords → a structured first
 * draft (title, slug, excerpt, SEO meta, outline, body sections).
 */
export function generateBlogDraft(input: BlogDraftInput): BlogDraftResult {
  const { topic, keywords = [], audience = 'everyday shoppers', category = 'Shopping' } = input;

  const title = capitalize(`${topic}: A Complete Guide for Smart Buying`);
  const slug = slugify(title);
  const keywordList = [...new Set([topic, ...keywords.map((k) => k.toLowerCase())])].slice(0, 6);

  const excerpt = `Shopping for ${topic.toLowerCase()}? Our practical guide breaks down what to look for, what to avoid, and how to get the best value in Bangladesh.`;

  const metaTitle = `${topic} Buying Guide 2026 | Pakistani Noor`;
  const metaDescription = `Read our ${topic.toLowerCase()} buying guide — expert tips, price ranges in Bangladesh, quality checks, and where to buy online with free delivery.`;

  const outline = [
    'Why this guide matters',
    `What to look for in a ${topic.toLowerCase()}`,
    'Quality checks to run before you pay',
    'Price ranges in Bangladesh & how to spot a good deal',
    'Care, maintenance & lifespan',
    'Frequently asked questions',
    'Final verdict',
  ];

  const sections: BlogSection[] = [
    {
      heading: 'Why this guide matters',
      content: `With so many options for ${topic.toLowerCase()} flooding the market, it is easy to overpay or end up with something that simply does not last. This guide distils everything we have learned serving shoppers across Bangladesh into one clear checklist — so you buy once and buy right.`,
    },
    {
      heading: `What to look for in a ${topic.toLowerCase()}`,
      content: `Start with the fundamentals: materials and build quality, brand reputation, after-sales support, and how the product is used day to day. For ${audience}, reliability usually beats flashy extras. Shortlist two or three options that fit your budget before comparing them side by side.`,
    },
    {
      heading: 'Quality checks to run before you pay',
      content: `Before checkout, verify the seller's return policy, check for verified customer reviews, and confirm the warranty terms in writing. On Pakistani Noor, every listing shows real ratings and photos from previous buyers, and our 7-day return window means you can inspect your purchase with zero risk.`,
    },
    {
      heading: 'Price ranges in Bangladesh & how to spot a good deal',
      content: `Prices for ${topic.toLowerCase()} in Bangladesh vary widely by brand and seller. As a rule of thumb, be wary of offers that look too good to be true — genuine sellers rarely discount below sustainable margins. Compare the price against the listing's original price and look for bundle or coupon deals instead of mysterious markdowns.`,
    },
    {
      heading: 'Care, maintenance & lifespan',
      content: `A little upkeep goes a long way. Follow the manufacturer's care instructions, store the product properly, and address small issues early before they become costly repairs. With the right care, even an entry-level ${topic.toLowerCase()} can outlast an expensive one that is neglected.`,
    },
    {
      heading: 'Frequently asked questions',
      content: `Q: Is cash on delivery available? A: Yes — we offer COD across all 64 districts of Bangladesh. Q: How long is delivery? A: Standard delivery takes 2-5 working days (free over ৳3,000); express takes 1-2 days. Q: What if I am not satisfied? A: You have 7 days to return any unused item in its original packaging for a full refund.`,
    },
    {
      heading: 'Final verdict',
      content: `The best ${topic.toLowerCase()} for you is the one that matches your actual needs, has an honest price, and comes with dependable after-sales support. Use this checklist, compare a few options, and shop with confidence at Pakistani Noor.`,
    },
  ];

  return {
    title,
    slug,
    excerpt,
    metaTitle,
    metaDescription,
    keywords: keywordList,
    outline,
    sections,
    engine: 'template',
    generated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Local utilities
// ---------------------------------------------------------------------------

function capitalize(text: string): string {
  return text.replace(/(^|\s)([a-z])/g, (_m, space: string, ch: string) => space + ch.toUpperCase());
}

export const contentStudioLocalEngines = {
  campaign: generateCampaignCopy,
  blog: generateBlogDraft,
  taka,
  slugify,
};