# Single-Vendor Ecommerce — Gap Analysis & Implementation Phases

**App:** Pakistani Noor (Next.js 16 App Router + MongoDB)
**Date:** 2026-09-20
**Scope:** Identify missing/broken features for a single-vendor ecommerce store and implement them phase by phase.

## Method
- Inspected the live admin panel entry (`/admin` → redirects to `/auth/admin-login`) and HTTP-checked every route the UI links to.
- Audited all 15 data models, ~60 API routes, and every admin/storefront page.

## Confirmed gaps (verified 404 / broken link / unwired model)

### A. Broken or missing ADMIN pages (all confirmed 404)
| Route | Referenced from | Status |
|---|---|---|
| `/admin/inventory` | Dashboard low-stock alert, sidebar | **404** |
| `/admin/products/[slug]` | Dashboard top-products, products list "Edit" | **404** |
| `/admin/orders/returns` | Sidebar "Returns" | 404 (matches `[orderNumber]`, then errors) |
| `/admin/support` | Sidebar "Support Tickets" | **404** (real page is `/admin/support-triage`) |
| `/admin/campaigns`, `/admin/referrals`, `/admin/loyalty` | Sidebar "Marketing" | **404** (Referral model exists; no UI) |
| `/admin/blog` | Sidebar "Content" | **404** (Blog model exists; no UI) |
| `/admin/pages` | Sidebar "Content" | **404** (no Page model at all) |
| `/admin/analytics` | Sidebar "Analytics" | **404** |
| `/admin/settings/payment\|shipping\|email\|seo` | Sidebar "Settings" | **404** (settings page already has tabs — links should target `?tab=` instead) |

### B. Broken STOREFRONT links (verified 404)
| Route | Referenced from | Status |
|---|---|---|
| `/category/[slug]` | Header nav + homepage category cards + footer | **404** |
| `/wishlist` | Header wishlist icon | **404** (real page: `/account/wishlist`) |
| `/blog`, `/about`, `/privacy`, `/terms` | Marketing/content (planned) | **404** |

### C. Missing FUNCTIONALITY (data layer exists, no UI/flow)
1. **Refunds & returns** — `Order.refunds[]` model exists; admin order detail can change status + tracking but has **no refund create/approve/complete flow**; no returns queue page.
2. **Blog** — full `Blog` model (draft/published/archived, SEO, comments, likes, AI drafts from Content Studio) with **no storefront listing, no article page, no admin CRUD**.
3. **CMS pages** — no `Page` model; no About/Privacy/Terms.
4. **Category browsing** — no storefront category page (header + homepage cards 404).
5. **Referral/Loyalty dashboards** — `Referral` model + settings exist; no admin views.
6. **Analytics** — dashboard has top-line stats + AI insights; no dedicated analytics (sales by category/product, AOV, geography, channel breakdown).
7. **Order actions** — order detail lacks: refund issuance, void/cancel of unpaid orders with stock restore, invoice download (Print → browser print only).

### D. Settings parity notes (NOT gaps — already wired)
Behaves correctly but worth knowing: checkout preview shows hardcoded shipping constants while the **order API computes real totals from Settings** (tax, free-shipping threshold, express fee, COD surcharge, loyalty redemption, gift wrap). The preview can differ from the charged total; noted as low-priority polish.

## Implementation phases

### Phase 1 — Navigation & core admin ops ✅ DONE
- AdminSidebar: Returns → `/admin/orders?status=returned`; Support Tickets → `/admin/support-triage`; Settings children → `?tab=payments|shipping|loyalty|email|seo`.
- Header wishlist → `/account/wishlist`; Footer links → real pages (`/account/orders`, `/account/wishlist`, `/pages/*`, `mailto:`).
- Settings page: `useSearchParams` `?tab=` deep-linking (was tab-switch only).
- Fixed admin products API filters (`inventory.quantity` → top-level `stock`) and new-product form submit mapping (stock, threshold, trackInventory, allowBackorder) — previously new products saved `stock: 0`.
- **`/admin/inventory`** + `/api/admin/inventory` (GET stats/list w/ `low`/`out`/`stocked` views + search; POST safe quantity set/adjust that never clobbers other fields).
- **`/admin/products/[slug]`** focused edit page (Basic/Media/Pricing/SEO tabs, image upload, stock/threshold, flags, badges, SEO, delete) using GET/PUT/DELETE `/api/admin/products/[slug]`.

### Phase 2 — Order operations ✅ DONE
- Admin order PUT now **restores product/variant stock + loyalty points** when status transitions into `cancelled`/`returned`/`refunded` (guarded against double-restore).
- **Refund flow**: `/api/admin/orders/[orderNumber]/refunds` (create pending, amount ≤ total − already refunded) + `/refunds/[refundId]` (approve / reject / complete). Completing a refund sets `payment.status = 'refunded'`, full-refund orders become `refunded`, and the customer gets a push notification.
- Admin order detail page: **Refunds panel** — refundable balance, create form, refund history with approve/reject/complete actions.
- Returns queue reached via `/admin/orders?status=returned` (status filter; sidebar fixed).

### Phase 3 — Storefront content ✅ DONE
- **`/category/[slug]`** browse page (breadcrumb, banner, sort, pagination via `/api/products`); fixed public `/api/categories` `parent=all` handling (was matching nothing).
- **Blog**: `/api/blog` (published list) + `/api/blog/[slug]` (view-count increment); `/blog` grid + `/blog/[slug]` article (markdown-lite renderer: `##`/`###`/`-`); admin CRUD `/api/admin/blog` + `/api/admin/blog/[id]` and **`/admin/blog`** (list w/ status tabs + publish/archive, full editor) — completes the Content Studio loop (AI drafts → review → publish).
- **CMS Pages**: new `Page` model (registered in `models/index.ts`); `/api/pages/[slug]` with **self-healing default templates** for `about`/`privacy`/`terms`/`shipping-policy`/`return-policy`; `/pages/[slug]` storefront renderer; admin `/api/admin/pages` + `/api/admin/pages/[id]` and **`/admin/pages`** editor; footer links rewired to `/pages/*`.

### Phase 4 — Marketing & analytics ✅ DONE
- **`/admin/analytics`** + `/api/admin/analytics?days=7|30|90`: revenue/orders/AOV/customers/products/refunded totals, revenue-by-day chart, sales by category (product→category lookups), top products, payment-method breakdown, top delivery cities, order-status breakdown.
  - Fixed latent off-by-one in the `/api/admin/analytics` `Promise.all` destructure (23 names vs 22 aggregations): `cartsCreated` now reads the `Cart.countDocuments` aggregation, `acquisitionByDay`/`clvAgg`/`orderSourcesAgg` land on their correct aggregations — previously the route 500'd on `orderSourcesAgg.map` and mislabeled every section after the funnel.
- **`/admin/referrals`** + `/api/admin/referrals` + `/referrals/[id]` (PATCH bonus-paid toggles): stat cards, status tabs + search, populated referee/referred table.
- **`/admin/loyalty`** + `/api/admin/loyalty`: active members / total outstanding points / top members by points, program config summary (from Settings), link to `?tab=loyalty`.
- **`/admin/campaigns`** + `/api/admin/campaigns`: coupons grouped by new optional `campaign` tag on `Coupon` (additive schema field); per-campaign redemptions/discount stats; inline rename/assign via existing `/api/admin/coupons/[id]`.

### Phase 5 — Store Intelligence ✅ DONE
- **`lib/ai/storeIntelligence.ts`** — pure deterministic engine (no API keys): `forecastRevenue` (linear trend × weekday seasonality with 95% band + 7/14/30-day projections), `computeCohortIntelligence` (monthly cohorts, month-over-month retention, cohort revenue), `computeTrafficIntelligence` (sessions, conversion, landing paths, hour-of-day, traffic sources), `computeProductAttention` (rising / seen-not-bought signals with prior-window deltas), `generateStoreInsights` (severity-ranked feed).
- **`/api/admin/store-intelligence?days=7|30|90`** — aggregates confirmed orders (revenue statuses), cohort identities (user id / guest email), traffic events, and product-view windows; returns forecast + cohorts + traffic + attention + insights. Returns clean 401 when unauthenticated.
- **`/admin/store-intelligence`** — dashboard: KPI row, severity-ranked insight feed, ForecastChart (solid historical / dashed forecast / shaded 95% band / now divider), cohort retention heatmap (`#cohorts` anchor), traffic sources + sessions/conversion + landing paths, hourly activity, rising-attention and seen-not-bought product lists; 7/30/90-day range toggle + refresh.
- AdminSidebar: Analytics group now has Analytic Insights + Store Intelligence.

### Verification
- `npx tsc --noEmit --incremental false` ✅ · `npm run build` ✅ (all routes in route table)
- Every link in `AdminSidebar`, `Header` and `Footer` HTTP-checked — **no 404s remain** (the previously missing routes now return 307 auth-redirect; storefront pages return 200).
- Store Intelligence validated via `scripts/si-smoke.ts` (hand-computed fixtures for forecast band / 40%·80% M1 retention / conversion rate / insight severity) and `scripts/si-db-check.ts` (same aggregations as the route against live MongoDB → engine → insights).

### Remaining backlog (out of scope for this pass)
- `/admin/orders/returns` dedicated queue page (status filter covers it today).
- Invoice download-as-PDF (Print uses browser print dialog).
- Storefront `/wishlist` standalone page (routed to `/account/wishlist`).
- Express options on the deleted `app/page.tsx` legacy home (single home route already in place).