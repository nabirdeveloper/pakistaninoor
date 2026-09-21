/**
 * AI Support Triage (Phase 5)
 * ===========================
 * Reads an inbound support ticket / message and instantly gives an agent the
 * information they need to act:
 *
 *   1. Category      — order / payment / shipping / product / refund / account /
 *                      return / technical / other.
 *   2. Priority      — low / medium / high / urgent (SLA-optimised).
 *   3. Sentiment     — positive / neutral / negative + abuse flags.
 *   4. Urgency       — how fast a human needs to touch it.
 *   5. Escalation    — should this bypass the normal queue?
 *   6. Suggested reply — a deterministic, on-brand Bangladeshi reply draft.
 *   7. SLA            — minutes until first response.
 *
 * Deterministic engine that always runs; the Python AI service upgrades to LLM
 * when a key is configured incl. confident-feeling replies to messy tickets.
 */



export type TicketCategory =
  | 'order'
  | 'payment'
  | 'shipping'
  | 'product'
  | 'refund'
  | 'account'
  | 'return'
  | 'technical'
  | 'other';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketSentiment = 'positive' | 'neutral' | 'negative';
export type TicketUrgency = 'hours' | 'same_day' | 'next_day' | 'business';

export interface SupportTriageInput {
  ticketId?: string;
  /** raw text body (customer or first message) */
  message: string;
  subject?: string;
  /** keywords / pre-selected category from the contact form, if any */
  categoryHint?: string;
  customerName?: string;
  orderId?: string;
  imageCount?: number;
  pastTicketCount?: number;
}

export interface SupportTriageResult {
  ticketId?: string;
  category: TicketCategory;
  confidence: 'high' | 'medium' | 'low';
  priority: TicketPriority;
  urgency: TicketUrgency;
  sentiment: TicketSentiment;
  isAbusive: boolean;
  isDuplicate: boolean;
  shouldEscalate: boolean;
  suggestedSlaMinutes: number;
  suggestedTags: string[];
  draftReply: string;
  summary: string;
  engine: 'llm' | 'rules';
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Deterministic keyword sets (Bangla + English, mirrors the Python service)
// ---------------------------------------------------------------------------

const LOW = (s: string) => (s || '').toLowerCase();

const PARTS: Array<[TicketCategory, string[]]> = [
  ['order', ['order', 'my order', 'order id', 'placed', "haven't received", 'not received', 'track', 'status', 'onde', 'cancel my order', 'change my order', 'wrong item shipped', 'missing item', 'partial']],
  ['payment', ['payment', 'pay', 'bkash', 'nagad', 'card', 'sslcommerz', 'cod', 'cash on delivery', 'charged', 'charge', 'double charge', 'deducted', 'invoice', 'transaction failed', 'payment failed', 'money deducted']],
  ['shipping', ['shipping', 'delivery', 'deliver', 'ship', 'courier', 'sundarban', 'pathao', 'tracking', 'parcel', 'arrive', 'arrival', 'eta', 'delay', 'delayed', 'address change', 'address update', 'shipping address']],
  ['product', ['product', 'product question', 'size', 'colour', 'color', 'variant', 'specification', 'specs', 'material', 'stock', 'in stock', 'out of stock', 'not as described', 'quality issue', 'defective', 'damaged in transit', 'broken', 'wrong colour', 'wrong size']],
  ['refund', ['refund', 'refunds', 'money back', 'reimburse', 'reimbursement authorized', 'gateway refund', 'credit cancelled', 'refund not received']],
  ['account', ['account', 'login', 'log in', 'password', 'otp', 'verify', 'verification', 'profile', 'email change', 'phone number change', 'deactivate', 'delete account', 'forgot password']],
  ['return', ['return', 'returns', 'exchange', 'replace', 'pickup', '7 day', '7-day', 'return window', 'return label', 'refund after return']],
  ['technical', ['technical', 'bug', 'error', 'app', 'website', 'page not loading', 'white screen', 'crash', 'payment gateway error', 'checkout error', 'broken link']],
];

const ABUSE_WORDS = [
  'scam', 'fraud', 'liar', 'cheat', 'stupid', 'idiot', 'moron', 'dumb', 'rude',
  'useless', 'hate', 'kill yourself', 'worst', 'pathetic', 'thief', 'con', 'ripoff',
  'boka', 'chor', 'dhokabaj', 'beiman', 'mittha', 'mattam', 'hala', 'gadha', 'khati',
];

const URGENT_WORDS = ['urgent', 'asap', 'immediately', 'right now', 'today', 'emergency', 'sobar', 'soshob', 'now!', 'cry', 'desperate'];
const PAYMENT_HIGH = new Set(['payment', 'refund']);

function bestCategory(text: string, hint?: string): { cat: TicketCategory; score: number } {
  const low = LOW(text);
  let bestCat: TicketCategory = 'other';
  let bestScore = 0;
  for (const [cat, keys] of PARTS) {
    let score = 0;
    for (const k of keys) {
      if (low.includes(k)) score += k.split(' ').length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }
  // A hint that matches expected categories wins ties.
  const hintCat = PARTS.find(([c]) => c === hint);
  if (hintCat && bestScore === 0) {
    bestCat = hintCat[0];
    bestScore = 1;
  }
  return { cat: bestCat, score: bestScore };
}

function countHits(text: string, words: string[]): number {
  const low = LOW(text);
  return words.reduce((acc, w) => (low.includes(w) ? acc + 1 : acc), 0);
}

const BRIEF = {
  order: "Order status and updates",
  payment: "Payment & gateway issue",
  shipping: "Delivery & tracking",
  product: "Product question / issue",
  refund: "Refund request",
  account: "Account & login support",
  return: "Return / exchange",
  technical: "Technical problem (app/site)",
  other: "General enquiry",
};

function draftReply(cat: TicketCategory, input: SupportTriageInput, abusive: boolean): string {
  const name = input.customerName ? input.customerName.trim().split(/\s+/)[0] : 'there';
  const withName = (body: string) =>
    `Hi ${name},\n\n${body}\n\nWarm regards,\nCustomer Care Team — Pakistani Noor`;

  if (abusive) {
    return withName(
      "thanks for flagging this — we take your frustration seriously and want to fix it properly. " +
      "Could you share your order number (or phone/email on the account) and a brief description of what " +
      "happened? We have a senior support lead on it and will get back to you personally."
    );
  }

  switch (cat) {
    case 'payment':
      return withName(
        "thanks for reaching out about your payment. If an amount was deducted but the order wasn't " +
        "confirmed, please share the order number and the last 4 digits / bKash reference — our payments " +
        "team will verify and, if it's a duplicate or failed charge, the refund follows within 3-5 working " +
        "days back to your bKash / Nagad / card."
      );
    case 'shipping':
      return withName(
        "we completely understand that waiting for a delivery is no fun. Drop us the tracking number (or " +
        "order number) and our logistics team will chase the courier partner immediately and share a " +
        "confirmed delivery window. Rest assured it's on its way."
      );
    case 'refund':
      return withName(
        "we're happy to help with your refund. Once our team confirms eligibility (usually same day), the " +
        "amount is processed back to your payment method within 3-5 working days. Share your order number " +
        "and the original payment method and we'll take it from there."
      );
    case 'return':
      return withName(
        "you're absolutely covered. Returns are free within 7 days of delivery, pickup arranged from your " +
        "doorstep, and the refund is released within 3-5 working days after quality check. Reply with your " +
        "order number and we'll schedule the pickup."
      );
    case 'product':
      return withName(
        "we appreciate the heads-up. If the item arrived damaged, defective, or not as described, you can " +
        "either get a free replacement or a full refund — your choice. Share a couple of photos and your " +
        "order number and we'll arrange it right away."
      );
    case 'account':
      return withName(
        "let's get you sorted. For login or OTP issues, share the phone/email on your account and we'll " +
        "help you recover access securely. For profile or password changes we can guide you step by step."
      );
    case 'technical':
      return withName(
        "sorry for the technical trouble! Please tell us which page you were on, what you were doing, and " +
        "any error message or screenshot. Our engineering team will look into it and get it fixed fast."
      );
    case 'order':
      return withName(
        "thanks for checking in. Share your order number and we'll pull up the live status right away. If " +
        "something looks off (missing item or wrong product), we'll fix it with a replacement or refund — " +
        "whichever you prefer."
      );
    default:
      return withName(
        "thanks for reaching out to Pakistani Noor. We've routed your message to the right team and " +
        "someone will get back to you shortly. If it's urgent, reply 'URGENT' and we'll prioritise it."
      );
  }
}

export function localTriageTicket(input: SupportTriageInput): SupportTriageResult {
  const now = new Date().toISOString();
  const text = `${input.subject ? input.subject + ' ' : ''}${input.message || ''}`.trim();
  const low = LOW(text);

  const { cat, score } = bestCategory(text, input.categoryHint);

  let urgencyScore = countHits(text, URGENT_WORDS) * 3;
  let sentiment: TicketSentiment = 'neutral';
  const negHits = countHits(text, ['not received', 'damaged', 'defective', 'wrong', 'broken', 'refund', 'charged', 'delay', 'failed', 'lost', 'cry', 'disappoint', 'frustrated', 'not working', 'never arrived']);
  const posHits = countHits(text, ['thanks', 'thank you', 'great', 'love', 'awesome', 'happy', 'perfect', 'excellent', 'helpful']);
  if (negHits > posHits) sentiment = 'negative';
  else if (posHits > 0) sentiment = 'positive';

  const abusive = countHits(text, ABUSE_WORDS) > 0;
  const repeated = (input as any).pastTicketCount >= 2;

  // ---- Priority & SLA ----
  let priority: TicketPriority = 'low';
  if (abusive) priority = 'urgent';
  else if (PAYMENT_HIGH.has(cat)) priority = 'high';
  else if (urgencyScore >= 6 || negHits >= 4) priority = 'high';
  else if (urgencyScore >= 3 || negHits >= 2 || cat === 'return' || cat === 'shipping') priority = 'medium';

  const slaByPriority: Record<TicketPriority, number> = {
    urgent: 30,
    high: 120,
    medium: 480,
    low: 1440,
  };

  const suggestedSlaMinutes = slaByPriority[priority] + (repeated ? -30 : 0);

  const confidence: 'high' | 'medium' | 'low' = score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low';

  const shouldEscalate = abusive || priority === 'urgent';
  const urgency: TicketUrgency =
    priority === 'urgent' ? 'hours' : priority === 'high' ? 'same_day' : priority === 'medium' ? 'next_day' : 'business';

  return {
    ticketId: input.ticketId,
    category: cat,
    confidence,
    priority,
    urgency,
    sentiment,
    isAbusive: abusive,
    isDuplicate: repeated,
    shouldEscalate,
    suggestedSlaMinutes: Math.max(15, suggestedSlaMinutes),
    suggestedTags: [cat, priority, ...(abusive ? ['escalate'] : []), ...(repeated ? ['repeat'] : [])],
    draftReply: draftReply(cat, input, abusive),
    summary: BRIEF[cat],
    engine: 'rules',
    generated_at: now,
  };
}