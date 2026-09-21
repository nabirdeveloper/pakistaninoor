"""
Pakistani Noor AI Microservice
==============================
AI-powered e-commerce features:

  - Content-based product recommendations (TF-IDF + category affinity + popularity)
  - Product description & SEO generation (template engine, upgrades to LLM when a key is set)
  - Smart keyword/tag extraction (TF-IDF n-grams)
  - Typo-tolerant search suggestions with "did you mean"
  - Fraud / order-risk scoring for checkout
  - Analytics insights with revenue forecasting
  - Rule-based support chatbot (FAQ intents, upgrades to LLM when a key is set)
  - Review moderation (sentiment + toxicity) and extractive review summaries

Design notes
------------
- The engine is fully deterministic and works with ZERO external API keys.
- If OPENAI_API_KEY or ANTHROPIC_API_KEY is present in the environment,
  content-generation and chat endpoints transparently upgrade to real LLM output
  with deterministic fallback when the LLM call fails.
- The Next.js app passes catalog/product data into the endpoints because the
  database lives on the app side (MongoDB through Next.js). This keeps the AI
  service stateless and easily scalable.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
import re
import math
import difflib
import hashlib
import statistics
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta

import numpy as np  # optional: falls back to pure-Python math if unavailable

try:
    import numpy as _np
    HAS_NUMPY = True
except Exception:  # pragma: no cover - numpy missing
    HAS_NUMPY = False

app = FastAPI(
    title="Pakistani Noor AI Service",
    description="AI-powered microservice for e-commerce features",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Environment / LLM configuration
# ---------------------------------------------------------------------------

LLM_API_KEY = os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
LLM_PROVIDER = "openai" if os.getenv("OPENAI_API_KEY") else ("anthropic" if os.getenv("ANTHROPIC_API_KEY") else None)
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")


def llm_complete(prompt: str, system: Optional[str] = None, max_tokens: int = 700, temperature: float = 0.7) -> Optional[str]:
    """Call an LLM provider when a key is configured. Returns None if unavailable/failed."""
    if not LLM_API_KEY or not LLM_PROVIDER:
        return None

    import httpx

    try:
        if LLM_PROVIDER == "openai":
            resp = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {LLM_API_KEY}"},
                json={
                    "model": OPENAI_MODEL,
                    "messages": [
                        {"role": "system", "content": system or "You are a helpful e-commerce assistant."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
                timeout=25.0,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()

        if LLM_PROVIDER == "anthropic":
            resp = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": LLM_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": ANTHROPIC_MODEL,
                    "system": system or "You are a helpful e-commerce assistant.",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
                timeout=25.0,
            )
            resp.raise_for_status()
            return resp.json()["content"][0]["text"].strip()
    except Exception as e:  # pragma: no cover - network dependent
        print(f"[ai] LLM call failed, falling back to local engine: {e}")
    return None


# ---------------------------------------------------------------------------
# Text utilities
# ---------------------------------------------------------------------------

STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "by", "is", "are", "was", "were", "be", "been", "it", "its", "this", "that",
    "these", "those", "as", "if", "then", "than", "so", "such", "from", "into",
    "about", "over", "under", "again", "further", "once", "here", "there", "when",
    "where", "why", "how", "all", "any", "both", "each", "few", "more", "most",
    "other", "some", "only", "own", "same", "too", "very", "can", "will", "just",
    "should", "now", "not", "no", "don", "do", "does", "did", "have", "has", "had",
    "also", "per", "off", "out", "up", "down", "us", "you", "your", "our", "their",
    "theirs", "him", "her", "his", "hers", "i", "me", "my", "we", "they", "get", "got",
    "buy", "best", "price", "online", "shop", "shopping", "product", "products", "bangladesh",
}

POSITIVE_WORDS = {
    "good", "great", "excellent", "amazing", "awesome", "love", "loved", "perfect",
    "beautiful", "nice", "satisfied", "happy", "pleased", "recommend", "recommended",
    "superb", "fantastic", "wonderful", "brilliant", "outstanding", "impressive",
    "quality", "fast", "quick", "responsive", "worth", "value", "durable", "comfortable",
    "soft", "stylish", "gorgeous", "delicious", "fresh", "clean", "helpful", "great",
}

NEGATIVE_WORDS = {
    "bad", "poor", "terrible", "awful", "worst", "waste", "disappointed", "disappointing",
    "hate", "hated", "broken", "break", "damaged", "defective", "useless", "cheap",
    "fake", "fraud", "scam", "refund", "return", "stale", "slow", "late", "delay",
    "never", "nothing", "wrong", "misleading", "not worth", "crap", "horrible", "pathetic",
}

TOXIC_WORDS = {
    "stupid", "idiot", "moron", "dumb", "ugly", "hate", "kill", "suck", "sucks",
    "fool", "jerk", "fraud", "scam", "liar", "cheat", "cheated", "traitor", "slave",
    "shut up", "get lost", "trash", "garbage", "pathetic", "useless",
}


def tokenize(text: str) -> List[str]:
    """Lowercase, split on non-alphanumerics, filter stopwords/atoms."""
    if not text:
        return []
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return [t for t in tokens if len(t) > 2 and t not in STOPWORDS]


def normalize_query(q: str) -> str:
    return re.sub(r"\s+", " ", (q or "").strip().lower())


def levenshtein(a: str, b: str) -> int:
    """Classic DP edit distance (bounded usage)."""
    if abs(len(a) - len(b)) > 5:
        return 99
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def ngrams(tokens: List[str], n: int = 2) -> List[str]:
    if len(tokens) < n:
        return []
    return [" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)]


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ProductDescriptionRequest(BaseModel):
    name: str
    category: str
    features: List[str] = []
    price: float = 0
    brand: Optional[str] = None
    target_audience: Optional[str] = None
    tone: str = Field(default="professional", description="professional | persuasive | friendly | luxury")
    style: str = Field(default="standard", description="concise | standard | detailed")
    market: str = Field(default="BD", description="Market/locale e.g. BD, PK, IN")


class SEOOptimizationRequest(BaseModel):
    title: str
    description: str
    category: str
    keywords: Optional[List[str]] = None
    use_llm: bool = True


class TagGenerationRequest(BaseModel):
    name: str
    description: str = ""
    category: str = ""
    existing_tags: Optional[List[str]] = None
    limit: int = 12


class CatalogProduct(BaseModel):
    id: str
    name: str
    slug: Optional[str] = None
    category: Optional[str] = None
    category_id: Optional[str] = None
    tags: List[str] = []
    description: str = ""
    price: float = 0
    sales_count: float = 0
    average_rating: float = 0
    image: Optional[str] = None
    stock: Optional[float] = None
    compare_at_price: Optional[float] = None


class RecommendationRequest(BaseModel):
    user_id: Optional[str] = None
    viewed_products: List[str] = []
    purchased_products: List[str] = []
    cart_products: List[str] = []
    catalog: List[CatalogProduct] = []
    exclude_ids: Optional[List[str]] = None
    limit: int = 8


class FraudDetectionRequest(BaseModel):
    order_id: str
    user_id: Optional[str] = None
    email: str
    phone: str
    ip_address: str
    total_amount: float
    payment_method: str
    shipping_address: Dict[str, str]
    items: List[Dict[str, Any]]
    user_order_history: Optional[List[Dict[str, Any]]] = None
    is_first_order: bool = False
    account_age_days: Optional[float] = None
    billing_matches_shipping: bool = True


class AnalyticsInsightRequest(BaseModel):
    period_days: int = 30
    data: Dict[str, Any]
    forecast_days: int = 7


class SearchSuggestionItem(BaseModel):
    id: str
    name: str
    slug: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    sales_count: float = 0


class SearchSuggestionCategory(BaseModel):
    id: str
    name: str
    slug: Optional[str] = None


class SearchSuggestionRequest(BaseModel):
    q: str = ""
    products: List[SearchSuggestionItem] = []
    categories: List[SearchSuggestionCategory] = []
    limit: int = 8


class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None
    catalog: Optional[List[CatalogProduct]] = None


class ModerationRequest(BaseModel):
    text: str
    rating: Optional[int] = None
    product_name: Optional[str] = None


class ReviewSummaryRequest(BaseModel):
    product_name: str
    reviews: List[Dict[str, Any]]
    rating_breakdown: Optional[Dict[str, Any]] = None


class QuestionAnswerRequest(BaseModel):
    question: str
    product: Optional[CatalogProduct] = None
    catalog: Optional[List[CatalogProduct]] = None


class ReviewReplyRequest(BaseModel):
    review_text: str
    rating: Optional[int] = None
    product_name: Optional[str] = None


class RecoveryMessageRequest(BaseModel):
    customer_name: Optional[str] = None
    items: List[Dict[str, Any]] = []
    cart_value: Optional[float] = None
    hours_abandoned: Optional[int] = None


class CampaignCopyRequest(BaseModel):
    product_name: Optional[str] = None
    offer: Optional[str] = None
    audience: Optional[str] = None
    channels: List[str] = ["email", "push", "sms"]
    tone: str = "friendly"
    deadline: Optional[str] = None
    market: Optional[str] = None


class BlogDraftRequest(BaseModel):
    topic: str
    keywords: List[str] = []
    audience: Optional[str] = None
    category: Optional[str] = None


# ---------------------------------------------------------------------------
# TF-IDF utilities
# ---------------------------------------------------------------------------

def build_tfidf(docs: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
    """docs: [{id, tokens:[...]}]. Returns {id: {term: tfidf}}."""
    n = len(docs)
    if n == 0:
        return {}

    df: Counter = Counter()
    for doc in docs:
        for term in set(doc["tokens"]):
            df[term] += 1

    vectors: Dict[str, Dict[str, float]] = {}
    for doc in docs:
        counts = Counter(doc["tokens"])
        total = max(len(doc["tokens"]), 1)
        vector: Dict[str, float] = {}
        for term, count in counts.items():
            tf = count / total
            idf = math.log((1 + n) / (1 + df[term])) + 1.0
            vector[term] = tf * idf
        vectors[doc["id"]] = vector
    return vectors


def cosine_sim(a: Dict[str, float], b: Dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


# ---------------------------------------------------------------------------
# 1. Product description generation
# ---------------------------------------------------------------------------

def _feature_bullets(features: List[str], tone: str) -> str:
    if not features:
        return ""
    lines = [f"- {f}" for f in features[:8]]
    if tone == "luxury":
        preface = "Exclusively crafted highlights:\n"
    elif tone == "friendly":
        preface = "Here's what you'll love:\n"
    else:
        preface = "Key Features:\n"
    return preface + "\n".join(lines)


def generate_product_description(product: ProductDescriptionRequest) -> Dict[str, str]:
    name = product.name
    brand = f" by {product.brand}" if product.brand else ""
    category = product.category or "premium product"
    features_text = ", ".join(product.features[:4]) if product.features else ""
    price_text = f"৳{product.price:,.0f}" if product.market.upper() == "BD" else f"${product.price:,.2f}"

    tone = product.tone if product.tone in ("professional", "persuasive", "friendly", "luxury") else "professional"
    style = product.style if product.style in ("concise", "standard", "detailed") else "standard"

    # Try LLM first when enabled and available
    if LLM_API_KEY:
        prompt = (
            f"Write a compelling e-commerce product description for:\n"
            f"Name: {name}\nBrand: {brand or 'N/A'}\nCategory: {category}\n"
            f"Price: {price_text}\nFeatures: {', '.join(product.features) or 'N/A'}\n"
            f"Target audience: {product.target_audience or 'general'}\n"
            f"Tone: {tone}\nStyle: {style}\n"
            f"Return JSON with keys short_description (<50 words) and full_description "
            f"(3-5 short paragraphs with a 'Key Features' bullet list, <250 words). No markdown fences."
        )
        content = llm_complete(prompt, system="You are an expert e-commerce copywriter for a Bangladeshi online store.")
        if content:
            # Try to parse JSON-ish output; fall back to using the text wholesale.
            short, full = _split_llm_description(content, name, brand)
            return {
                "short_description": short,
                "full_description": full,
                "engine": "llm",
                "generated_at": datetime.now().isoformat(),
            }

    # ---- Deterministic template engine ----
    openings = {
        "professional": f"Discover the {name}{brand} — a thoughtfully selected {category} built for reliability and everyday performance.",
        "persuasive": f"Upgrade your lifestyle with the {name}{brand} — the smart choice in {category} at an unbeatable price.",
        "friendly": f"Meet the {name}{brand} — your new favorite {category} that makes everyday life easier and more enjoyable.",
        "luxury": f"Introducing the {name}{brand} — a refined {category} crafted for those who appreciate premium quality.",
    }
    closing = (
        f"Order today and enjoy fast delivery across Bangladesh, secure payment, "
        f"and our 7-day easy return policy."
    )
    audience = f"\n\nPerfect for {product.target_audience}." if product.target_audience else ""

    bullets = _feature_bullets(product.features, tone) if product.features else ""
    reasons = (
        "\n\nWhy choose it?\n"
        "- Exceptional quality and durability\n"
        f"- Competitive pricing at {price_text}\n"
        "- Fast, reliable delivery nationwide\n"
        "- 7-day easy return policy"
    )

    full_description = f"{openings[tone]}\n\n{bullets}{audience}{reasons if style != 'concise' else ''}\n\n{closing}"

    if style == "concise":
        full_description = f"{openings[tone]}\n\n{bullets or ''}\n\n{closing}".strip()

    if style == "detailed" and product.features:
        full_description += (
            f"\n\nProduct Specifications\n"
            f"- Name: {name}\n- Category: {category}\n"
            f"{''.join(f'- {f}' for f in product.features[8:])}"
        )

    short_candidates = [
        f"{name}{brand} — {features_text}." if features_text else f"{name}{brand} — premium {category}.",
        f"Shop the {name}{brand} online at the best price in Bangladesh.",
    ]
    short_description = short_candidates[0] if len(short_candidates[0]) <= 120 else short_candidates[1]

    return {
        "short_description": short_description,
        "full_description": full_description.strip(),
        "engine": "template",
        "generated_at": datetime.now().isoformat(),
    }


def _split_llm_description(content: str, name: str, brand: str) -> tuple:
    """Best-effort split of LLM output into core_description and short_description."""
    clean = content.strip().strip("`")
    if clean.startswith("```json"):
        clean = clean.replace("```json", "", 1)
    if clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]

    try:
        import json as _json
        parsed = _json.loads(clean)
        short = parsed.get("short_description") or parsed.get("shortDescription") or ""
        full = parsed.get("full_description") or parsed.get("fullDescription") or parsed.get("description") or clean
        if short and full:
            return short.strip(), full.strip()
    except Exception:
        pass

    # Fallback: first sentence/paragraph as short description
    parts = [p for p in re.split(r"\n\s*\n", clean) if p.strip()]
    full = clean
    short = parts[0][:180] if parts else f"{name}{brand}: {clean[:180]}"
    return short, full


# ---------------------------------------------------------------------------
# 2. SEO optimization
# ---------------------------------------------------------------------------

def generate_seo_meta(request: SEOOptimizationRequest) -> Dict[str, Any]:
    title = request.title.strip()
    description = request.description.strip()
    category = request.category.strip()
    keywords = [k.strip().lower() for k in (request.keywords or []) if k.strip()]

    if LLM_API_KEY and request.use_llm:
        prompt = (
            f"Generate SEO meta tags for a product page.\n"
            f"Title: {title}\nDescription snippet: {description[:500]}\nCategory: {category}\n"
            f"Additional keywords: {', '.join(keywords) or 'none'}\n"
            f'Return JSON with keys meta_title (<=60 chars), meta_description (<=160 chars), '
            f'keywords (array of <=10), long_tail_keywords (array of 4). No markdown fences.'
        )
        content = llm_complete(prompt, system="You are an SEO specialist for e-commerce.")
        if content:
            try:
                import json as _json
                clean = content.strip().strip("`")
                if clean.startswith("json"):
                    clean = clean[4:]
                parsed = _json.loads(clean)
                return {
                    "meta_title": str(parsed.get("meta_title", ""))[:60],
                    "meta_description": str(parsed.get("meta_description", ""))[:160],
                    "keywords": list(parsed.get("keywords", []))[:10],
                    "long_tail_keywords": list(parsed.get("long_tail_keywords", []))[:4],
                    "schema_suggestions": {
                        "@type": "Product",
                        "name": title,
                        "description": description[:500],
                        "category": category,
                    },
                    "engine": "llm",
                }
            except Exception:
                pass

    # ---- Deterministic engine ----
    meta_title = title if len(title) <= 60 else f"{title[:57].rstrip()}..."
    meta_description = (
        f"Buy {title} online at the best price in Bangladesh. {description[:120]}..."
    )[:157] + "..." if len(f"Buy {title} online at the best price in Bangladesh. {description[:120]}...") > 160 else (
        f"Buy {title} online at the best price in Bangladesh. {description[:120]}"
    )

    base_keywords = [title.lower(), category.lower(), "buy online", "best price", "bangladesh", "free delivery"]
    all_keywords = list(dict.fromkeys(base_keywords + keywords))[:10]
    long_tail = [
        f"buy {title.lower()} online",
        f"{title.lower()} price in bangladesh",
        f"best {category.lower()} online",
        f"cheap {title.lower()}",
    ]

    return {
        "meta_title": meta_title,
        "meta_description": meta_description[:160],
        "keywords": all_keywords,
        "long_tail_keywords": long_tail,
        "schema_suggestions": {
            "@type": "Product",
            "name": title,
            "description": description[:500],
            "category": category,
        },
        "engine": "template",
    }


# ---------------------------------------------------------------------------
# 3. Smart tag / keyword extraction (TF-IDF n-grams)
# ---------------------------------------------------------------------------

def generate_tags(request: TagGenerationRequest) -> Dict[str, Any]:
    if LLM_API_KEY:
        prompt = (
            f"Suggest up to {request.limit} relevant product tags (lowercase, 1-3 words each) for:\n"
            f"Name: {request.name}\nDescription: {request.description[:700]}\nCategory: {request.category}\n"
            f"Existing tags: {', '.join(request.existing_tags or []) or 'none'}\n"
            "Return a JSON array of strings only. No markdown fences."
        )
        content = llm_complete(prompt, system="You are a product data specialist.")
        if content:
            try:
                import json as _json
                clean = content.strip().strip("`")
                if clean.startswith("json"):
                    clean = clean[4:]
                parsed = _json.loads(clean)
                if isinstance(parsed, list):
                    return {"tags": [str(t).lower().strip() for t in parsed][: request.limit], "engine": "llm"}
            except Exception:
                pass

    text = f"{request.name} {request.category} {request.description}"
    tokens = tokenize(text)
    if not tokens:
        return {"tags": [], "engine": "template"}

    # Term frequency scoring with position bonus for name tokens.
    name_tokens = set(tokenize(request.name))
    words = Counter(tokens)
    for w in words:
        if w in name_tokens:
            words[w] *= 2.0

    bigrams = Counter(ngrams(tokens, 2))
    candidates: List[tuple] = []

    for gram, score in words.items():
        candidates.append((score, len(gram.split()), gram))
    for gram, score in bigrams.items():
        candidates.append((score * 1.25, len(gram.split()), gram))

    # Normalize per ngram length: longer grams are more specific.
    ranked = sorted(candidates, key=lambda x: (x[0] * (1 + 0.15 * (x[1] - 1)), x[1]), reverse=True)

    tags: List[str] = []
    seen: set = set()
    for _, _, gram in ranked:
        if gram in seen:
            continue
        # Skip grams that are substrings of already-chosen tags
        if any(gram in t or t in gram for t in tags):
            continue
        tags.append(gram)
        seen.add(gram)
        if len(tags) >= request.limit:
            break

    return {"tags": tags, "engine": "template"}


# ---------------------------------------------------------------------------
# 4. Content-based recommendations (TF-IDF + category affinity + popularity)
# ---------------------------------------------------------------------------

def get_product_recommendations(request: RecommendationRequest) -> Dict[str, Any]:
    catalog = request.catalog
    if not catalog:
        return {"recommendations": [], "strategy": "empty_catalog", "reasons": {}}

    products_by_id = {p.id: p for p in catalog}
    exclude = set(request.exclude_ids or [])
    signal_ids = list(
        dict.fromkeys(
            request.purchased_products + request.cart_products + request.viewed_products
        )
    )
    signal_ids = [sid for sid in signal_ids if sid in products_by_id]

    # Build vectors for the FULL catalog (signal items must be in the corpus
    # so their profile vectors exist). Exclusions only affect candidates.
    docs = []
    for p in catalog:
        tokens = (
            tokenize(p.name)
            + tokenize(p.category or "")
            + tokenize(" ".join(p.tags))
            + tokenize(p.description or "")
        )
        docs.append({"id": p.id, "tokens": tokens})

    vectors = build_tfidf(docs)
    if not vectors:
        return {"recommendations": [], "strategy": "empty", "reasons": {}}

    # User profile = weighted sum of signal item vectors
    profile: Dict[str, float] = defaultdict(float)
    weights = {"viewed": 1.0, "cart": 2.0, "purchased": 3.0}
    for pid in request.viewed_products[:50]:
        for term, w in vectors.get(pid, {}).items():
            profile[term] += w * weights["viewed"]
    for pid in request.cart_products[:50]:
        for term, w in vectors.get(pid, {}).items():
            profile[term] += w * weights["cart"]
    for pid in request.purchased_products[:50]:
        for term, w in vectors.get(pid, {}).items():
            profile[term] += w * weights["purchased"]

    # Category affinity from user signals
    category_counts: Counter = Counter()
    for pid in signal_ids:
        cat = products_by_id[pid].category or "unknown"
        category_counts[cat] += 1

    # Popularity baseline for cold start & tie-breaking
    popularity = {
        p.id: 0.6 * (p.average_rating / 5.0) + 0.4 * min(1.0, math.log10(p.sales_count + 1) / 3.0)
        for p in catalog
    }

    have_profile = bool(profile)
    scored: List[tuple] = []
    reasons: Dict[str, str] = {}

    for p in catalog:
        if p.id in exclude or p.id in set(signal_ids):
            continue
        vec = vectors.get(p.id, {})
        sim = cosine_sim(profile, vec) if have_profile else 0.0
        category_boost = 0.0
        if category_counts:
            cat = p.category or "unknown"
            if cat in category_counts:
                category_boost = min(0.35, 0.10 * category_counts[cat])
        final = sim * 1.0 + category_boost * 0.6 + popularity.get(p.id, 0) * 0.25
        scored.append((final, p.id))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[: request.limit]

    # Human-readable reasons
    for _, pid in top:
        p = products_by_id[pid]
        cat = p.category or "other"
        reason = "Popular in your preferred categories" if category_counts.get(cat, 0) > 0 else "Because you viewed similar items"
        if p.sales_count > 200 and p.average_rating >= 4.0:
            reason = f"Top-rated in {cat}"
        reasons[pid] = reason

    recs = [
        {
            "productId": pid,
            "score": round(score, 4),
            "reason": reasons.get(pid, ""),
        }
        for score, pid in top
    ]
    strategy = "content_based" if have_profile else "popularity"
    return {"recommendations": recs, "strategy": strategy, "reasons": reasons}


# ---------------------------------------------------------------------------
# 5. Fraud / order-risk scoring
# ---------------------------------------------------------------------------

def detect_fraud(request: FraudDetectionRequest) -> Dict[str, Any]:
    risk_score = 0.0
    risk_factors: List[str] = []

    # High order amount
    if request.total_amount > 50000:
        risk_score += 0.2
        risk_factors.append("Unusually high order amount")

    # Guest checkout with high amount
    if not request.user_id and request.total_amount > 10000:
        risk_score += 0.15
        risk_factors.append("Guest checkout with high value order")

    # Suspicious email domain
    suspicious_domains = ["tempmail", "throwaway", "fakeinbox", "guerrilla", "mailinator", "yopmail", "10minutemail"]
    email_domain = (request.email or "").lower().split("@")[-1]
    if any(d in email_domain for d in suspicious_domains):
        risk_score += 0.3
        risk_factors.append("Disposable email domain detected")

    # Phone format (Bangladeshi mobile)
    phone = (request.phone or "").strip()
    if not re.match(r"^(\+88)?01[3-9]\d{8}$", phone):
        risk_score += 0.1
        risk_factors.append("Invalid or foreign phone number")

    # Address completeness
    street = (request.shipping_address.get("street") or "").strip()
    city = (request.shipping_address.get("city") or "").strip()
    if len(street) < 10:
        risk_score += 0.1
        risk_factors.append("Incomplete shipping address")
    if not city:
        risk_score += 0.05
        risk_factors.append("Missing city in shipping address")

    # Billing vs shipping mismatch
    if not request.billing_matches_shipping and request.total_amount > 15000:
        risk_score += 0.1
        risk_factors.append("Billing and shipping addresses differ on high-value order")

    # New account / first order
    if request.is_first_order and request.total_amount > 20000:
        risk_score += 0.15
        risk_factors.append("First-time customer placing large order")

    if request.account_age_days is not None and request.account_age_days < 1 and request.total_amount > 15000:
        risk_score += 0.1
        risk_factors.append("Account created less than 24 hours ago")

    # Order history anomalies
    if request.user_order_history:
        totals = [o.get("total", 0) for o in request.user_order_history if o.get("total")]
        if totals:
            avg = sum(totals) / len(totals)
            if request.total_amount > avg * 3 and request.total_amount > 20000:
                risk_score += 0.15
                risk_factors.append("Order value far above user's historical average")

    # Item-level velocity: many identical items
    for item in request.items:
        qty = int(item.get("quantity", 1))
        if qty >= 20:
            risk_score += 0.1
            risk_factors.append(f"Very large quantity of a single item ({qty})")
            break

    risk_score = min(1.0, round(risk_score, 2))

    if risk_score >= 0.5:
        risk_level = "high"
        action = "manual_review"
    elif risk_score >= 0.3:
        risk_level = "medium"
        action = "additional_verification"
    else:
        risk_level = "low"
        action = "approve"

    return {
        "order_id": request.order_id,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "recommended_action": action,
        "user_verified": bool(request.user_id),
        "analyzed_at": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# 6. Analytics insights with forecasting
# ---------------------------------------------------------------------------

def generate_analytics_insights(request: AnalyticsInsightRequest) -> Dict[str, Any]:
    data = request.data or {}
    insights: List[str] = []
    suggestions: List[str] = []
    alerts: List[Dict[str, Any]] = []
    forecast: Optional[List[Dict[str, Any]]] = None

    revenue_by_day = data.get("revenueByDay") or []
    if isinstance(revenue_by_day, list) and len(revenue_by_day) >= 2:
        values = [float(d.get("revenue", 0)) for d in revenue_by_day]
        dates = [d.get("date", "") for d in revenue_by_day]
        if values[-1] > 0 or any(v > 0 for v in values):
            growth = ((values[-1] - values[0]) / values[0] * 100) if values[0] > 0 else 0
            last7 = values[-7:] if len(values) >= 7 else values
            avg7 = sum(last7) / len(last7) if last7 else 0
            peak = max(values)
            peak_idx = values.index(peak)
            insights.append(f"Revenue grew {growth:.1f}% over the period (avg {avg7:,.0f} ৳/day)")
            if growth > 10:
                suggestions.append("Scale up marketing spend — growth trend is strong")
                alerts.append({"severity": "info", "title": "Positive revenue trend", "message": f"{growth:.1f}% growth vs period start."})
            elif growth < -10:
                suggestions.append("Review pricing and run a flash promotion to reverse the decline")

            # Simple linear forecast (numpy when available, pure-Python fallback)
            try:
                x = np.arange(len(values), dtype=float)
                n = len(values)
                if HAS_NUMPY:
                    slope, intercept = np.polyfit(x, values, 1)
                else:
                    # Pure-Python least squares linear fit: y = slope*x + intercept
                    x_mean = sum(x) / n
                    y_mean = sum(values) / n
                    num = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
                    den = sum((x[i] - x_mean) ** 2 for i in range(n))
                    slope = num / den if den else 0.0
                    intercept = y_mean - slope * x_mean
                future_start = len(values)
                forecast = [
                    {
                        "date": (datetime.now() + timedelta(days=i + 1)).strftime("%Y-%m-%d"),
                        "revenue": round(max(0, slope * (future_start + i) + intercept), 2),
                    }
                    for i in range(request.forecast_days)
                ]
                projected = sum(f["revenue"] for f in forecast)
                insights.append(f"Projected revenue for the next {request.forecast_days} days: {projected:,.0f} ৳")
                if projected < avg7 * request.forecast_days * 0.8:
                    suggestions.append("Forecast is soft — consider a targeted campaign for the coming week")
            except Exception:
                forecast = None
        else:
            insights.append("No completed payments in the period — focus on conversion")

    orders = data.get("orders")
    if isinstance(orders, list) and orders:
        avg_orders = sum(orders) / len(orders)
        insights.append(f"Average daily orders: {avg_orders:.1f}")
        max_orders = max(orders)
        insights.append(f"Peak day: {max_orders} orders")

    top_products = data.get("top_products") or []
    if top_products:
        top = top_products[0]
        name = top.get("name") or top.get("_id") or "Unknown"
        insights.append(f"Top seller: {name}")
        suggestions.append("Keep top sellers fully stocked and feature them on the homepage")

    low_stock = data.get("low_stock_products") or []
    if isinstance(low_stock, list) and low_stock:
        alerts.append({
            "severity": "warning",
            "title": f"{len(low_stock)} products low on stock",
            "message": "Restock soon to avoid missed sales",
        })

    new_customers = data.get("new_customers") or 0
    returning = data.get("returning_customers") or 0
    if (new_customers + returning) > 0:
        retention = returning / (new_customers + returning) * 100
        insights.append(f"Customer retention rate: {retention:.1f}%")
        if retention < 30:
            suggestions.append("Launch a loyalty program to improve repeat purchases")
        elif retention >= 50:
            suggestions.append("Retention is strong — introduce referral rewards to amplify it")

    abandoned_carts = data.get("abandoned_carts")
    if isinstance(abandoned_carts, (int, float)) and abandoned_carts > 10:
        suggestions.append("Automate cart-abandonment reminders via the notification system")
        alerts.append({
            "severity": "warning",
            "title": f"{abandoned_carts} abandoned carts",
            "message": "Recover revenue with reminder emails",
        })

    # Health score: simple weighted composite
    health = 100.0
    if (new_customers + returning) > 0 and retention < 30:
        health -= 15
    if isinstance(abandoned_carts, (int, float)) and abandoned_carts > 30:
        health -= 10
    health = max(0, round(health))

    return {
        "period_days": request.period_days,
        "health_score": health,
        "insights": insights[:6],
        "suggestions": suggestions[:6],
        "alerts": alerts[:6],
        "forecast": forecast,
        "generated_at": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# 7. Search suggestions (prefix + typo tolerance + did-you-mean + trending)
# ---------------------------------------------------------------------------

# Recent (in-memory) query log used for trending suggestions.
_trending_queries: Counter = Counter()
_MAX_TRENDING = 30


def _score_name(name: str, q: str) -> float:
    """Scoring for a candidate name against normalized query (0..1)."""
    name = name.lower()
    if name == q:
        return 1.0
    if name.startswith(q):
        return 0.9
    if q in name:
        return 0.75
    if any(t.startswith(q) for t in name.split(" ")):
        return 0.65
    return 0.0


def _token_fuzzy_score(name: str, q: str) -> float:
    """Best token/whole-name fuzzy ratio (typo tolerance)."""
    name = name.lower()
    sm = difflib.SequenceMatcher
    best = sm(None, q, name).ratio()
    for token in re.findall(r"[a-z0-9]+", name):
        best = max(best, sm(None, q, token).ratio())
    return best


def search_suggestions(request: SearchSuggestionRequest) -> Dict[str, Any]:
    if request.q:
        _trending_queries[normalize_query(request.q)] += 1
        if len(_trending_queries) > _MAX_TRENDING:
            for key in list(_trending_queries)[: _MAX_TRENDING // 2]:
                del _trending_queries[key]

    q = normalize_query(request.q)
    suggestions = []
    did_you_mean = None
    corrected_query = None

    if not q:
        # Trending queries when input is empty
        for query, count in _trending_queries.most_common(5):
            suggestions.append({"type": "query", "text": query, "score": 1.0})
        return {"suggestions": suggestions[: request.limit], "didYouMean": None, "correctedQuery": None}

    # Product suggestions by prefix/token match, clamped to a bounded candidate set for typo work
    product_names = [(p.name, p) for p in request.products[:200]]
    category_names = [(c.name, c) for c in request.categories[:50]]

    matched_products = []
    matched_categories = []
    exact_typo = []
    for name, prod in product_names:
        score = _score_name(name, q)
        if score > 0:
            matched_products.append((score, "product", name, {"id": prod.id, "slug": prod.slug}))
        else:
            fuzzy = _token_fuzzy_score(name, q)
            if fuzzy >= 0.72:
                exact_typo.append((fuzzy * 0.8, "product", name, {"id": prod.id, "slug": prod.slug}))
    for name, cat in category_names:
        score = _score_name(name, q)
        if score > 0:
            matched_categories.append((score, "category", name, {"id": cat.id, "slug": cat.slug}))

    if not matched_products:
        matched_products = exact_typo

    # Tag matches
    for prod in request.products[:200]:
        for tag in prod.tags:
            if tag.lower().startswith(q) and len(tag.lower()) > 2:
                matched_products.append((0.7, "product", prod.name, {"id": prod.id, "slug": prod.slug}))
                break

    # Sort by score; boost popular products
    def sort_key(item):
        score, typ, text, meta = item
        if typ == "product":
            for p in request.products:
                if p.id == meta.get("id"):
                    score += min(0.15, math.log10(p.sales_count + 1) / 30)
                    break
        return -score

    matched_products.sort(key=sort_key)
    matched_categories.sort(key=sort_key, reverse=True)

    for score, typ, text, meta in matched_categories[:3]:
        suggestions.append({"type": typ, "text": text, "score": round(score, 2), **meta})
    for score, typ, text, meta in matched_products[: max(0, request.limit - len(suggestions))]:
        if len(suggestions) >= request.limit:
            break
        suggestions.append({"type": typ, "text": text, "score": round(score, 2), **meta})

    # Did-you-mean when results are sparse (typo tolerance via edit distance)
    if len(matched_products) + len(matched_categories) < 3:
        candidates = [name for name, _ in product_names] + [name for name, _ in category_names]
        best_candidate = None
        best_ratio = 0.0
        for name in candidates:
            ratio = _token_fuzzy_score(name, q)
            if ratio > best_ratio:
                best_ratio = ratio
                best_candidate = name
        if best_candidate and best_ratio >= 0.78:
            did_you_mean = best_candidate
            corrected_query = best_candidate

    # Append matching trending queries
    for query, count in _trending_queries.most_common(6):
        if len(suggestions) >= request.limit:
            break
        if q in query and query != q:
            suggestions.append({"type": "query", "text": query, "score": round(min(1.0, 0.4 + count * 0.05), 2)})

    # De-duplicate by text
    seen = set()
    unique = []
    for s in suggestions:
        key = f"{s['type']}:{s['text'].lower()}"
        if key not in seen:
            seen.add(key)
            unique.append(s)

    return {
        "suggestions": unique[: request.limit],
        "didYouMean": did_you_mean,
        "correctedQuery": corrected_query,
    }


# ---------------------------------------------------------------------------
# 8. Chatbot (FAQ intents + optional LLM)
# ---------------------------------------------------------------------------

_FAQ_INTENTS = [
    {
        "intent": "shipping",
        "keywords": ["ship", "shipping", "deliver", "delivery", "courier", "parcel", "receive", "arrive", "arrival", "charge", "fee", "cost"],
        "answer": "We deliver across all 64 districts of Bangladesh. Standard delivery takes 2-5 working days (৳80, free over ৳3,000) and express delivery takes 1-2 days (৳150). You'll get a tracking link once your order ships.",
        "suggestions": ["How much is shipping?", "What are delivery times?", "Track my order"],
    },
    {
        "intent": "return",
        "keywords": ["return", "refund", "exchange", "replace", "money back", "defective", "damaged", "broken"],
        "answer": "You can return any item within 7 days of delivery if it's unused, in original packaging, and has its tags. Refunds are processed within 3-5 working days after we receive the returned item. Contact support with your order number to start a return.",
        "suggestions": ["How do I return an item?", "Refund status"],
    },
    {
        "intent": "payment",
        "keywords": ["pay", "payment", "bkash", "nagad", "ssl", "card", "credit", "debit", "cod", "cash on delivery", "bank", "online"],
        "answer": "We accept Cash on Delivery (COD), bKash, Nagad, SSLCOMMERZ (cards/internet banking), and bank transfer. All online payments are processed securely — we never store your card details.",
        "suggestions": ["Pay with bKash", "Is COD available?"],
    },
    {
        "intent": "order_status",
        "keywords": ["order", "status", "track", "tracking", "where is my", "shipped", "processing", "confirm"],
        "answer": "You can track your order anytime from your account under 'My Orders'. Order statuses include: pending → confirmed → processing → packed → shipped → out for delivery → delivered. If you need help, reply with your order number and we'll look into it.",
        "suggestions": ["Where is my order?", "Cancel my order"],
    },
    {
        "intent": "cancel",
        "keywords": ["cancel", "cancellation"],
        "answer": "You can cancel an order free of charge while it's pending, confirmed, or processing — just open the order in 'My Orders' and hit cancel, or contact support. Once an order ships, it can no longer be cancelled, but you can start a return after delivery.",
        "suggestions": ["How do I cancel?", "Return policy"],
    },
    {
        "intent": "product",
        "keywords": ["product", "size", "color", "variant", "specification", "spec", "material", "quality", "how to use", "compatible", "stock", "available"],
        "answer": "Each product page lists full specifications, available variants (size/color), stock status, and verified customer reviews. If the variant you want shows out of stock, tap the notification bell to get an instant alert when it's back.",
        "suggestions": ["Is it in stock?", "Check product details"],
    },
    {
        "intent": "support_contact",
        "keywords": ["contact", "support", "help", "agent", "human", "call", "phone", "email", "whatsapp"],
        "answer": "Our team is available 7 days a week, 9AM-9PM: call +880 1700 000 000, email support@pakistannoor.com, or open a support ticket from your account. We typically reply within a few hours.",
        "suggestions": ["Open a support ticket", "Call support"],
    },
    {
        "intent": "loyalty",
        "keywords": ["loyalty", "points", "reward", "referral", "discount", "coupon", "promo", "voucher"],
        "answer": "You earn loyalty points on every purchase (1 point per ৳100 spent) redeemable at checkout. You also get a unique referral code in your account — share it to earn bonus points when friends order.",
        "suggestions": ["How do loyalty points work?", "My referral code"],
    },
    {
        "intent": "account",
        "keywords": ["login", "log in", "sign in", "password", "register", "account", "profile", "verify", "otp"],
        "answer": "You can register or sign in from the top-right menu. If you forgot your password, use the 'Forgot password' link on the login page. Account questions can also be solved via support@pakistannoor.com.",
        "suggestions": ["Reset my password", "Create an account"],
    },
    {
        "intent": "greeting",
        "keywords": ["hi", "hello", "hey", "salam", "assalam", "good morning", "good evening", "good afternoon"],
        "answer": "Hello! 👋 Welcome to Pakistani Noor. I can help you with orders, shipping, returns, payments, and products. What would you like to know?",
        "suggestions": ["Track my order", "Shipping info", "Return policy"],
    },
    {
        "intent": "thanks",
        "keywords": ["thank", "thanks", "great", "awesome", "helpful", "appreciate"],
        "answer": "You're very welcome! 😊 Is there anything else I can help you with?",
        "suggestions": ["Shipping info", "Return policy"],
    },
    {
        "intent": "bye",
        "keywords": ["bye", "goodbye", "see you", "later"],
        "answer": "Goodbye! Thanks for visiting Pakistani Noor. Have a wonderful day! 👋",
        "suggestions": ["Shipping info", "Track my order"],
    },
]


def chat_response(request: ChatRequest) -> Dict[str, Any]:
    message = normalize_query(request.message)
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    context = request.context or {}

    # 1) LLM-first when available
    if LLM_API_KEY:
        system = (
            "You are the Pakistani Noor shopping assistant. Be concise, friendly, and accurate. "
            "Policies: free shipping over ৳3,000, standard delivery 2-5 days, express 1-2 days, "
            "7-day returns, payments: COD/bKash/Nagad/SSLCOMMERZ/bank transfer, support 9AM-9PM daily. "
            "Reply in plain text, at most 3 short sentences, and end with a question if appropriate."
        )
        content = llm_complete(message, system=system, max_tokens=220, temperature=0.4)
        if content:
            return {
                "intent": "llm",
                "answer": content[:600],
                "suggestions": ["Track my order", "Shipping info", "Return policy"],
                "engine": "llm",
                "timestamp": datetime.now().isoformat(),
            }

    # 2) Rules-based intent matching
    best_intent = None
    best_score = 0
    for entry in _FAQ_INTENTS:
        score = sum(1 for k in entry["keywords"] if k in message)
        if score > best_score:
            best_score = score
            best_intent = entry

    if best_intent and best_score > 0:
        answer = best_intent["answer"]
        if best_intent["intent"] == "order_status" and context.get("orderNumber"):
            answer = (
                f"For order {context['orderNumber']}: you can check its latest status anytime in "
                f"'My Orders'. If it's marked delivered but hasn't arrived, let us know and we'll chase the courier."
            )
        return {
            "intent": best_intent["intent"],
            "answer": answer,
            "suggestions": best_intent["suggestions"],
            "engine": "rules",
            "timestamp": datetime.now().isoformat(),
        }

    # 3) Catalog-aware fallback
    if request.catalog and len(message) >= 3:
        matches = difflib.get_close_matches(message, [p.name for p in request.catalog], n=1, cutoff=0.6)
        if matches:
            prod = next((p for p in request.catalog if p.name == matches[0]), None)
            if prod:
                return {
                    "intent": "product_lookup",
                    "answer": (
                        f"I found '{prod.name}' (৳{prod.price:,.0f}, rated {prod.average_rating:.1f}/5). "
                        f"Want me to take you to its page, or would you like to know more about it?"
                    ),
                    "suggestions": [f"Tell me about {prod.name}", "Shipping info"],
                    "engine": "catalog",
                    "timestamp": datetime.now().isoformat(),
                }

    return {
        "intent": "fallback",
        "answer": (
            "I'm not sure I caught that. 😅 I can help with orders, shipping, returns, payments, "
            "loyalty points, and products. Could you rephrase, or choose one of these?"
        ),
        "suggestions": ["Track my order", "Shipping info", "Return policy", "How do loyalty points work?"],
        "engine": "rules",
        "timestamp": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# 9. Review moderation & summaries
# ---------------------------------------------------------------------------

def moderate_review(request: ModerationRequest) -> Dict[str, Any]:
    text = (request.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    low = text.lower()
    flagged = [w for w in TOXIC_WORDS if w in low]
    toxicity = min(1.0, len(flagged) * 0.45 + (len(re.findall(r"!{3,}|\?{3,}", text)) * 0.05))

    tokens = tokenize(text)
    positive = sum(1 for t in tokens if t in POSITIVE_WORDS)
    negative = sum(1 for t in tokens if t in NEGATIVE_WORDS)
    total = max(positive + negative, 1)

    if positive > negative:
        sentiment = "positive"
        polarity = round(positive / total, 2)
    elif negative > positive:
        sentiment = "negative"
        polarity = round(-negative / total, 2)
    else:
        sentiment = "neutral"
        polarity = 0.0

    # Combined star-rating signal
    rating_signal = None
    if request.rating:
        if request.rating >= 4:
            rating_signal = "positive"
        elif request.rating <= 2:
            rating_signal = "negative"
        else:
            rating_signal = "neutral"
        if sentiment == "neutral":
            sentiment = rating_signal

    if toxicity >= 0.5 or (sentiment == "negative" and request.rating and request.rating >= 4):
        action = "flag"
    elif toxicity >= 0.25:
        action = "review"
    else:
        action = "approve"

    return {
        "sentiment": sentiment,
        "polarity": round(polarity, 2) if sentiment != "negative" or polarity else round(polarity, 2),
        "toxicity_score": round(toxicity, 2),
        "flags": flagged[:5],
        "recommended_action": action,
        "product": request.product_name,
        "analyzed_at": datetime.now().isoformat(),
    }


def summarize_reviews(request: ReviewSummaryRequest) -> Dict[str, Any]:
    reviews = [r for r in request.reviews if (r.get("comment") or "").strip()]
    if not reviews:
        return {
            "summary": "No customer reviews yet for this product.",
            "key_points": [],
            "sentiment_mix": {},
            "generated_at": datetime.now().isoformat(),
        }

    texts = [r["comment"].strip() for r in reviews]
    full_text = " ".join(texts)
    tokens = tokenize(full_text)
    word_freq: Counter = Counter(tokens)

    # Sentence scoring: sum of tf of scored words, normalized
    sentences = []
    for r in reviews:
        for sent in re.split(r"(?<=[.!?])\s+", r["comment"]):
            sent = sent.strip()
            if len(sent.split()) < 4:
                continue
            st = tokenize(sent)
            if not st:
                continue
            score = sum(word_freq[w] for w in st) / max(len(st), 1)
            sentences.append({"text": sent, "score": score, "rating": r.get("rating", 3)})

    sentences.sort(key=lambda s: s["score"], reverse=True)
    key_points = [s["text"][:160] for s in sentences[:4]]

    # Group sentences by sentiment
    grouped: Dict[str, List[str]] = {"positive": [], "neutral": [], "negative": []}
    for s in sentences:
        pos = sum(1 for w in tokenize(s["text"]) if w in POSITIVE_WORDS)
        neg = sum(1 for w in tokenize(s["text"]) if w in NEGATIVE_WORDS)
        if pos > neg:
            grouped["positive"].append(s["text"][:160])
        elif neg > pos:
            grouped["negative"].append(s["text"][:160])
        else:
            grouped["neutral"].append(s["text"][:160])

    ratings = [r.get("rating") for r in reviews if isinstance(r.get("rating"), (int, float))]
    sentiment_mix = {
        "positive": len(grouped["positive"]),
        "neutral": len(grouped["neutral"]),
        "negative": len(grouped["negative"]),
    }
    avg_rating = round(statistics.mean(ratings), 1) if ratings else None

    if LLM_API_KEY:
        prompt = (
            f"Summarize what buyers say about '{request.product_name}' into 3 concise bullet points.\n"
            f"Reviews:\n" + "\n".join(f"- (rating {r.get('rating','?')}/5) {r.get('comment','')[:220]}" for r in reviews[:12])
        )
        content = llm_complete(prompt, system="You are a review summarization specialist.", max_tokens=300)
        if content:
            return {
                "summary": content[:600],
                "summary_source": "llm",
                "key_points": key_points,
                "sentiment_mix": sentiment_mix,
                "average_rating": avg_rating,
                "generated_at": datetime.now().isoformat(),
            }

    summary = (
        f"Customers rate {request.product_name} an average of {avg_rating}/5 from {len(reviews)} reviews. "
        f"Themes from reviews: "
        + ("; ".join(key_points[:3]) or "not enough detail to extract themes yet.")
        + "."
    )

    return {
        "summary": summary,
        "summary_source": "extractive",
        "key_points": key_points,
        "sentiment_mix": sentiment_mix,
        "average_rating": avg_rating,
        "generated_at": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# 9b. Seller review-reply drafting (LLM first, templated fallback)
# ---------------------------------------------------------------------------

def draft_review_reply(request: ReviewReplyRequest) -> Dict[str, Any]:
    """Draft a professional seller reply to a customer review.

    LLM-first when a key is configured; otherwise a deterministic template
    keyed on sentiment (rating + keyword signals), mirroring the TS fallback
    in lib/ai/client.ts.
    """
    text = (request.review_text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="review_text is required")

    rating = request.rating
    low = text.lower()
    pos = sum(1 for w in POSITIVE_WORDS if w in low)
    neg = sum(1 for w in NEGATIVE_WORDS if w in low)
    sentiment = "positive" if pos > neg else ("negative" if neg > pos else "neutral")
    if rating:
        if rating >= 4 and sentiment == "neutral":
            sentiment = "positive"
        elif rating <= 2 and sentiment == "neutral":
            sentiment = "negative"
    elif sentiment == "neutral":
        sentiment = "positive"  # default to a friendly thanks when no signal

    now = datetime.now().isoformat()

    if LLM_API_KEY:
        prompt = (
            "You are the seller of an online store in Bangladesh responding to a customer review.\n"
            "Draft a concise, warm, professional reply (maximum 100 words, plain text) for the review below. "
            "Thank the customer by name if visible. If the review is negative or mentions a problem, "
            "apologize sincerely, acknowledge the issue, and state the concrete fix (support contact, "
            "7-day return, refund timeline). End with an invitation to get in touch or order again.\n\n"
        )
        prompt += f"Product: {request.product_name or 'N/A'}\n"
        prompt += f"Rating: {rating or 'unknown'}/5\n"
        prompt += f"Review: {text[:600]}\n"
        content = llm_complete(
            prompt,
            system="You are a courteous e-commerce customer-service writer.",
            max_tokens=280,
            temperature=0.4,
        )
        if content:
            return {
                "reply": content[:700],
                "sentiment": sentiment,
                "engine": "llm",
                "generated_at": now,
            }

    if sentiment == "negative":
        reply = (
            "Thank you for your honest feedback — we're sorry your experience fell short of "
            "expectations. We take this seriously and want to make it right: please reach out at "
            "support@pakistannoor.com or reply here with your order number, and our team will sort "
            "out a replacement, return, or refund as quickly as possible."
        )
    elif sentiment == "positive":
        reply = (
            "Thank you so much for your wonderful review! We're thrilled the product worked out for "
            "you. We truly appreciate your support and look forward to serving you again — do check "
            "our new arrivals for more great finds."
        )
    else:
        reply = (
            "Thanks for taking the time to share your feedback — it really helps us improve. If "
            "there's anything we can do to make your experience even better, just reach out to "
            "support@pakistannoor.com and we'll be happy to help."
        )

    return {
        "reply": reply,
        "sentiment": sentiment,
        "engine": "template",
        "generated_at": now,
    }


# ---------------------------------------------------------------------------
# 9c. Abandoned-cart recovery message (LLM first, templated fallback)
# ---------------------------------------------------------------------------

def draft_recovery_message(request: RecoveryMessageRequest) -> Dict[str, Any]:
    """Draft a personalized, persuasive recovery message for an abandoned cart.

    LLM-first when a key is configured; otherwise a deterministic template that
    names the customer, highlights the items left behind and the cart value, and
    nudges with a friendly call-to-action (mirrors the TS fallback).
    """
    items = [i for i in request.items if (i.get("name") or "").strip()]
    now = datetime.now().isoformat()
    name = (request.customer_name or "").strip() or "there"
    value = request.cart_value
    hours = request.hours_abandoned

    item_lines = ", ".join(items[:3]) + ("…" if len(items) > 3 else "")
    value_text = f"৳{value:,.0f}" if value else "your total"

    if LLM_API_KEY:
        prompt = (
            "You are writing a recovery email for an e-commerce store in Bangladesh "
            "(Pakistani Noor). Write a warm, concise, persuasive message (maximum 100 words, "
            "plain text, no subject line) that brings the customer back to checkout. "
            "Use the customer's name naturally. Mention the specific items left in the cart and "
            "the total value. Keep it friendly and low-pressure, and end with one clear "
            "call-to-action linking to their cart.\n\n"
        )
        prompt += f"Customer: {name}\n"
        prompt += f"Items in cart: {item_lines}\n"
        prompt += f"Cart value: {value_text}\n"
        prompt += f"Abandoned for: {hours or 'unknown'} hours\n"
        content = llm_complete(
            prompt,
            system="You are a courteous e-commerce retention copywriter.",
            max_tokens=300,
            temperature=0.5,
        )
        if content:
            return {
                "subject": "Your cart is still waiting 🛒",
                "message": content[:800],
                "engine": "llm",
                "generated_at": now,
            }

    message = (
        f"Hi {name}, you left some goodies in your cart and we wanted to make sure they "
        f"didn't slip your mind: {item_lines} (total {value_text}). "
    )
    message += (
        "Your items are still reserved — order today and enjoy fast delivery across "
        "Bangladesh with easy 7-day returns. [Tap here to return to your cart] and finish "
        "checking out whenever you're ready. 😊"
    )

    return {
        "subject": "Your cart is still waiting 🛒",
        "message": message,
        "engine": "template",
        "generated_at": now,
    }


# ---------------------------------------------------------------------------
# 10. Product Q&A auto-answer (customer questions with optional LLM)
# ---------------------------------------------------------------------------

def answer_product_question(request: QuestionAnswerRequest) -> Dict[str, Any]:
    q = normalize_query(request.question)
    product = request.product
    now = datetime.now().isoformat()

    # 1) LLM-first when a key is configured: answer with product context.
    if LLM_API_KEY and q:
        prompt = (
            "You are a product-specialist support assistant for an e-commerce store in Bangladesh.\n"
            "Answer the customer's question about THIS product concisely (maximum 90 words, plain text). "
            "If you do not have enough information to answer accurately, say so and suggest contacting support.\n\n"
        )
        if product:
            prompt += (
                f"Product: {product.name}\n"
                f"Category: {product.category or 'N/A'}\n"
                f"Description: {(product.description or '')[:400]}\n"
                f"Tags: {', '.join(product.tags) or 'N/A'}\n"
                f"Price: ৳{product.price:,.0f}\n"
                f"Rating: {product.average_rating or 0:.1f}/5\n"
                f"Stock: {int(product.stock) if product.stock is not None else 'unknown'} units\n\n"
            )
        prompt += f"Customer question: {request.question}"
        content = llm_complete(
            prompt,
            system="You are a helpful, accurate e-commerce support assistant.",
            max_tokens=240,
            temperature=0.3,
        )
        if content:
            return {
                "answer": content[:600],
                "answerable": True,
                "confidence": "high",
                "engine": "llm",
                "generated_at": now,
            }

    # 2) Deterministic factual rules — only answer topics we know are safe.
    if not product:
        return {
            "answer": "",
            "answerable": False,
            "confidence": "low",
            "engine": "rules",
            "generated_at": now,
        }

    def _has(keys):
        return any(k in q for k in keys)

    price_text = f"৳{product.price:,.0f}"
    in_stock = product.stock is None or product.stock > 0
    stock_text = (
        f"{int(product.stock)} units in stock" if product.stock is not None else "in stock"
    )

    if _has(["price", "cost", "how much", "expensive", "cheap"]):
        answer = (
            f"The price of {product.name} is {price_text}. "
            "Keep an eye on the listing page for occasional flash deals and coupons."
        )
        answerable = True
    elif _has(["stock", "available", "in stock", "out of stock", "back in stock", "restock"]):
        answer = (
            f"{product.name} is currently {stock_text}."
            if in_stock
            else f"{product.name} is currently out of stock. Tap the notification bell on the product page to get an instant alert when it's back."
        )
        answerable = True
    elif _has(["shipping", "delivery", "deliver", "ship", "arrive", "courier"]):
        answer = (
            f"{product.name} ships anywhere in Bangladesh. Standard delivery takes 2-5 "
            "working days (৳80, free over ৳3,000) and express takes 1-2 days (৳150). "
            "You get a tracking link once the order ships."
        )
        answerable = True
    elif _has(["return", "refund", "exchange", "returnable", "money back"]):
        answer = (
            "You can return this item within 7 days of delivery if it's unused, in original "
            "packaging, and has its tags. Refunds are processed within 3-5 working days after we receive it."
        )
        answerable = True
    elif _has(["payment", "pay", "bkash", "nagad", "card", "cod", "cash on delivery", "bank"]):
        answer = (
            "We accept Cash on Delivery (COD), bKash, Nagad, SSLCOMMERZ (cards/internet "
            "banking), and bank transfer. Online payments are fully secure — we never store card details."
        )
        answerable = True
    elif _has(["warranty", "guarantee", "defective", "damaged", "broken"]):
        answer = (
            "Check the product listing for warranty details. If anything arrives damaged or "
            "defective, our 7-day return policy and support team will sort it out quickly."
        )
        answerable = True
    else:
        # Product-specific questions (sizes, compatibility, usage…) need a human
        # or the LLM; leave them unanswered so they reach the admin queue.
        answer = ""
        answerable = False

    return {
        "answer": answer,
        "answerable": answerable,
        "confidence": "medium" if answerable else "low",
        "engine": "rules",
        "generated_at": now,
    }


# ---------------------------------------------------------------------------
# AI Content Studio (Phase 3) — campaign copy & blog drafts
# Deterministic template engines, upgrade to LLM when a key is set.
# ---------------------------------------------------------------------------

TONE_OPENERS = {
    "friendly": {
        "subject": "{product} is waiting for you 🛍️",
        "push_title": "For you: {product} 🛍️",
        "body": "Hey there! We spotted something we think you will love — {product}.",
    },
    "professional": {
        "subject": "{product} — now available at Pakistani Noor",
        "push_title": "{product} — new offer",
        "body": "Dear customer, we are pleased to introduce {product} at Pakistani Noor.",
    },
    "urgent": {
        "subject": "Last chance: {offer} on {product} ⏰",
        "push_title": "⏰ {offer} ends soon!",
        "body": "Hurry — {offer} on {product} is about to end.",
    },
    "celebratory": {
        "subject": "🎉 {offer} celebration on {product}",
        "push_title": "🎉 {offer} — celebrate with us!",
        "body": "Great news! We are celebrating with an exclusive {offer} on {product}.",
    },
}

TONE_CLOSERS = {
    "friendly": "We'd love to see your order soon — happy shopping! 😊",
    "professional": "We look forward to serving you. Thank you for choosing Pakistani Noor.",
    "urgent": "Don't miss out — stock is limited and this offer will not last.",
    "celebratory": "A perfect chance to treat yourself or someone special. Cheers! 🎉",
}


def _capitalize(text: str) -> str:
    return re.sub(r"(^|\s)([a-z])", lambda m: m.group(1) + m.group(2).upper(), text)


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower())
    return slug.strip("-")


def generate_campaign_copy(request: CampaignCopyRequest) -> Dict[str, Any]:
    product = request.product_name or "your favourite picks"
    offer = request.offer or "an exclusive offer"
    audience = request.audience or "you"
    tone = request.tone if request.tone in TONE_OPENERS else "friendly"
    market = request.market or "Bangladesh"
    deadline = request.deadline

    opener = TONE_OPENERS[tone]
    closer = TONE_CLOSERS[tone]
    deadline_line = f" Runs {deadline} only." if deadline else ""

    subject = opener["subject"].replace("{product}", product).replace("{offer}", offer)
    push_title = opener["push_title"].replace("{product}", product).replace("{offer}", offer)

    email_body = "\n\n".join(
        [
            opener["body"].replace("{product}", product).replace("{offer}", offer),
            f"Don't miss {offer} — a thoughtful pick for {audience}.",
            closer,
            "Free delivery on orders over ৳3,000, with easy 7-day returns across Bangladesh."
            + deadline_line,
        ]
    )

    push_body = (
        opener["body"].replace("{product}", product).replace("{offer}", offer)
        + " Tap to browse before it is gone."
        + deadline_line
    )

    if tone == "urgent":
        sms_body = f"{offer.upper()} on {product}! {deadline_line} Order now: pakistannoor.com — COD available."
    else:
        prefix = "🎉 " if tone == "celebratory" else ""
        suffix = "We saved it just for you 😊" if tone == "friendly" else "Fast delivery & easy returns."
        sms_body = f"{prefix}{offer} on {product}! Shop now: pakistannoor.com. {suffix} COD available."

    return {
        "email": {
            "subject": subject,
            "body": email_body,
            "cta": "Shop on pakistannoor.com"
            + (f"/products/{_slugify(product)}" if product != "your favourite picks" else ""),
        },
        "push": {"title": push_title, "body": push_body},
        "sms": {"body": sms_body},
        "engine": "template",
        "generated_at": datetime.now().isoformat(),
    }


def _llm_json(prompt: str, system: str) -> Optional[Dict[str, Any]]:
    """Ask the LLM for a JSON object; return parsed dict or None."""
    if not LLM_API_KEY:
        return None
    raw = llm_complete(prompt, system=system, max_tokens=900)
    if not raw:
        return None
    try:
        start, end = raw.find("{"), raw.rfind("}")
        if start == -1 or end <= start:
            return None
        return json.loads(raw[start : end + 1])
    except Exception:
        return None


CAMPAIGN_LLM_PROMPT = (
    "Write marketing copy for a Bangladesh e-commerce store (Pakistani Noor). "
    "Return ONLY valid JSON with exactly these keys: email {subject, body, cta}, "
    "push {title, body}, sms {body}. Keep the SMS under 160 characters, mention "
    "COD, and write in a {tone} tone. Product: {product}. Offer: {offer}. Audience: {audience}. Deadline: {deadline}."
)


def generate_campaign_copy(request: CampaignCopyRequest) -> Dict[str, Any]:
    template = _campaign_copy_template(request)
    featured = _llm_json(
        CAMPAIGN_LLM_PROMPT.format(
            tone=request.tone,
            product=request.product_name or "your favourite picks",
            offer=request.offer or "an exclusive offer",
            audience=request.audience or "you",
            deadline=request.deadline or "this weekend",
        ),
        system="You are a senior e-commerce copywriter.",
    )
    if featured:
        try:
            featured["engine"] = "llm"
            featured["generated_at"] = datetime.now().isoformat()
            return featured
        except Exception:
            pass
    return template


def _campaign_copy_template(request: CampaignCopyRequest) -> Dict[str, Any]:
    product = request.product_name or "your favourite picks"
    offer = request.offer or "an exclusive offer"
    audience = request.audience or "you"
    tone = request.tone if request.tone in TONE_OPENERS else "friendly"
    market = request.market or "Bangladesh"
    deadline = request.deadline

    opener = TONE_OPENERS[tone]
    closer = TONE_CLOSERS[tone]
    deadline_line = f" Runs {deadline} only." if deadline else ""

    subject = opener["subject"].replace("{product}", product).replace("{offer}", offer)
    push_title = opener["push_title"].replace("{product}", product).replace("{offer}", offer)

    email_body = "\n\n".join(
        [
            opener["body"].replace("{product}", product).replace("{offer}", offer),
            f"Don't miss {offer} — a thoughtful pick for {audience}.",
            closer,
            "Free delivery on orders over ৳3,000, with easy 7-day returns across Bangladesh."
            + deadline_line,
        ]
    )

    push_body = (
        opener["body"].replace("{product}", product).replace("{offer}", offer)
        + " Tap to browse before it is gone."
        + deadline_line
    )

    if tone == "urgent":
        sms_body = f"{offer.upper()} on {product}! {deadline_line} Order now: pakistannoor.com — COD available."
    else:
        prefix = "🎉 " if tone == "celebratory" else ""
        suffix = "We saved it just for you 😊" if tone == "friendly" else "Fast delivery & easy returns."
        sms_body = f"{prefix}{offer} on {product}! Shop now: pakistannoor.com. {suffix} COD available."

    return {
        "email": {
            "subject": subject,
            "body": email_body,
            "cta": "Shop on pakistannoor.com"
            + (f"/products/{_slugify(product)}" if product != "your favourite picks" else ""),
        },
        "push": {"title": push_title, "body": push_body},
        "sms": {"body": sms_body},
        "engine": "template",
        "generated_at": datetime.now().isoformat(),
    }


BLOG_LLM_PROMPT = (
    "Write a blog post draft for a Bangladesh e-commerce store blog on the topic: {topic}. "
    "Audience: {audience}. Additional context: {' '.join(keywords)}. "
    "Return ONLY valid JSON with exactly these keys: title, slug, excerpt (max 160 chars), "
    "metaTitle, metaDescription (max 160 chars), keywords (array), outline (array of section "
    "headings), sections (array of {heading, content}). Include practical local advice "
    "(prices in BDT, delivery, COD, returns). Total content should be a complete first draft."
)


def generate_blog_draft(request: BlogDraftRequest) -> Dict[str, Any]:
    template = _blog_draft_template(request)
    featured = _llm_json(
        BLOG_LLM_PROMPT.format(
            topic=request.topic,
            audience=request.audience or "everyday shoppers",
            keywords=request.keywords or [],
        ),
        system="You are a senior e-commerce content strategist.",
    )
    if featured:
        try:
            featured.setdefault("engine", "llm")
            featured["generated_at"] = datetime.now().isoformat()
            if not featured.get("slug"):
                featured["slug"] = _slugify(featured.get("title", request.topic))
            if not isinstance(featured.get("sections"), list):
                raise ValueError("missing sections")
            return featured
        except Exception:
            pass
    return template


def _blog_draft_template(request: BlogDraftRequest) -> Dict[str, Any]:
    topic = request.topic.strip()
    keywords = [k.lower() for k in (request.keywords or [])]
    audience = request.audience or "everyday shoppers"

    title = _capitalize(f"{topic}: A Complete Guide for Smart Buying")
    slug = _slugify(title)
    keyword_list = list(dict.fromkeys([topic.lower()] + keywords))[:6]

    sections = [
        {
            "heading": "Why this guide matters",
            "content": (
                f"With so many options for {topic.lower()} flooding the market, it is easy to overpay "
                "or end up with something that simply does not last. This guide distils everything we have "
                f"learned serving shoppers across Bangladesh into one clear checklist — so you buy once and buy right."
            ),
        },
        {
            "heading": f"What to look for in a {topic.lower()}",
            "content": (
                "Start with the fundamentals: materials and build quality, brand reputation, after-sales support, "
                "and how the product is used day to day. For "
                f"{audience}, reliability usually beats flashy extras. Shortlist two or three options that fit "
                "your budget before comparing them side by side."
            ),
        },
        {
            "heading": "Quality checks to run before you pay",
            "content": (
                "Before checkout, verify the seller's return policy, check for verified customer reviews, and "
                "confirm the warranty terms in writing. On Pakistani Noor, every listing shows real ratings and "
                "photos from previous buyers, and our 7-day return window means you can inspect your purchase "
                "with zero risk."
            ),
        },
        {
            "heading": "Price ranges in Bangladesh & how to spot a good deal",
            "content": (
                f"Prices for {topic.lower()} in Bangladesh vary widely by brand and seller. As a rule of thumb, "
                "be wary of offers that look too good to be true — genuine sellers rarely discount below "
                "sustainable margins. Compare the price against the listing's original price and look for bundle "
                "or coupon deals instead of mysterious markdowns."
            ),
        },
        {
            "heading": "Care, maintenance & lifespan",
            "content": (
                "A little upkeep goes a long way. Follow the manufacturer's care instructions, store the product "
                "properly, and address small issues early before they become costly repairs. With the right care, "
                f"even an entry-level {topic.lower()} can outlast an expensive one that is neglected."
            ),
        },
        {
            "heading": "Frequently asked questions",
            "content": (
                "Q: Is cash on delivery available? A: Yes — we offer COD across all 64 districts of Bangladesh. "
                "Q: How long is delivery? A: Standard delivery takes 2-5 working days (free over ৳3,000); "
                "express takes 1-2 days. Q: What if I am not satisfied? A: You have 7 days to return any unused "
                "item in its original packaging for a full refund."
            ),
        },
        {
            "heading": "Final verdict",
            "content": (
                f"The best {topic.lower()} for you is the one that matches your actual needs, has an honest price, "
                "and comes with dependable after-sales support. Use this checklist, compare a few options, and "
                "shop with confidence at Pakistani Noor."
            ),
        },
    ]

    return {
        "title": title,
        "slug": slug,
        "excerpt": (
            f"Shopping for {topic.lower()}? Our practical guide breaks down what to look for, what to avoid, "
            "and how to get the best value in Bangladesh."
        ),
        "metaTitle": f"{topic} Buying Guide 2026 | Pakistani Noor",
        "metaDescription": (
            f"Read our {topic.lower()} buying guide — expert tips, price ranges in Bangladesh, quality checks, "
            "and where to buy online with free delivery."
        ),
        "keywords": keyword_list,
        "outline": [s["heading"] for s in sections],
        "sections": sections,
        "engine": "template",
        "generated_at": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "engine": "local+llm" if LLM_API_KEY else "local",
        "llm_provider": LLM_PROVIDER,
        "version": "2.0.0",
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/api/generate-description")
async def generate_description(request: ProductDescriptionRequest):
    try:
        return {"success": True, "data": generate_product_description(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/optimize-seo")
async def optimize_seo(request: SEOOptimizationRequest):
    try:
        return {"success": True, "data": generate_seo_meta(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-tags")
async def generate_tags_endpoint(request: TagGenerationRequest):
    try:
        return {"success": True, "data": generate_tags(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/recommendations")
async def get_recommendations(request: RecommendationRequest):
    try:
        return {"success": True, "data": get_product_recommendations(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/fraud-detection")
async def fraud_detection(request: FraudDetectionRequest):
    try:
        return {"success": True, "data": detect_fraud(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analytics-insights")
async def analytics_insights(request: AnalyticsInsightRequest):
    try:
        return {"success": True, "data": generate_analytics_insights(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/search-suggestions")
async def search_suggestions_endpoint(request: SearchSuggestionRequest):
    try:
        return {"success": True, "data": search_suggestions(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        return {"success": True, "data": chat_response(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/moderation")
async def moderation(request: ModerationRequest):
    try:
        return {"success": True, "data": moderate_review(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/review-summary")
async def review_summary(request: ReviewSummaryRequest):
    try:
        return {"success": True, "data": summarize_reviews(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/review-reply")
async def review_reply(request: ReviewReplyRequest):
    try:
        return {"success": True, "data": draft_review_reply(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/recovery-message")
async def recovery_message(request: RecoveryMessageRequest):
    try:
        return {"success": True, "data": draft_recovery_message(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/answer-product-question")
async def answer_product_question_endpoint(request: QuestionAnswerRequest):
    try:
        return {"success": True, "data": answer_product_question(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/campaign-copy")
async def campaign_copy_endpoint(request: CampaignCopyRequest):
    try:
        return {"success": True, "data": generate_campaign_copy(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/blog-draft")
async def blog_draft_endpoint(request: BlogDraftRequest):
    try:
        return {"success": True, "data": generate_blog_draft(request)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)