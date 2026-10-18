# Fashion Rockstar LTD — Research, Architecture & Roadmap

## 1. Competitor research summary

Benchmarked: Monsoon (children's occasionwear), Boden, Joules, Next and Frugi. We use them only for research. No code, images, copy or branding has been copied.

| Pattern seen | Who does it well | What we built |
|---|---|---|
| Thin announcement bar for delivery and returns offers | Monsoon, Next | Announcement bar you edit in the admin |
| Department-first navigation (Women / Girls / Boys / Baby) with mega-menu by category | Monsoon, Next | Departments with mega-menus built automatically from the categories that have live products |
| Large editorial hero with a single call to action | Monsoon, Boden | Hero with editable text, image and button |
| Occasion and celebration edits | Monsoon | A "Collection / edit" field on each product, shown as homepage tiles |
| Age-based sizing for children (3–4y, 5–6y…) | Boden, Joules | Age sizes sort in the right order; size guide page |
| Filters by size, colour, price and stock, with product counts | Next | Filters built from the real product data; they combine; result count shown |
| Sale price shown next to the crossed-out regular price, with % off | All | Automatic: the % is calculated from the regular and sale prices |
| Fabric, care and origin on the product page | Frugi | Optional fields, with a note to enter only verified information |
| Guest checkout | All | Guest checkout; order tracking by order number and email |
| Live chat with the option of a person | Next | Gemini assistant, with handoff to your team (in-site replies or WhatsApp) |

## 2. Architecture

```
Browser ──► Next.js app (storefront + admin + API routes)
              │  server-side: pricing, stock, discounts, auth, validation
              ├──► MySQL (Prisma)  products, variants, orders, chats, settings, audit log
              ├──► Stripe Checkout       card / Apple Pay / Google Pay; webhooks back to /api/webhooks/stripe
              ├──► Gemini API            chat assistant grounded in live catalogue + policies
              └──► WhatsApp (wa.me link) customer → owner's number with chat reference
```

- **Modular monolith.** One Next.js app and one database. This is the simplest setup that is secure and easy to run, and it can be split up later if traffic justifies it.
- **Money** is stored as whole pence or cents, with the currency recorded. No floating-point arithmetic is used.
- **The order is created before payment** as *Pending payment*. It is marked *Paid* only by a verified webhook. Stock is deducted at payment time with a guarded update that cannot go below zero.
- **Admin security:**
  - Passwords are bcrypt-hashed.
  - The login cookie is HMAC-signed, httpOnly and SameSite=Strict, and expires after 8 hours.
  - Login attempts are rate-limited.
  - Each role has only the permissions it needs.
  - Every admin change is written to the audit log.
  - Server actions check the request's origin.
- **Uploads:** image types are checked from the file bytes, files are limited to 5MB, file names are random, and SVG is not accepted.

### Data model
`AdminUser`, `Category`, `Product` (GBP and USD prices with optional sale prices), `ProductImage`, `Variant` (SKU, size, colour, stock), `DiscountCode`, `Order` and `OrderItem` (each line keeps a copy of the name, SKU and price at the time of sale), `WebhookEvent` (stops duplicate processing), `ChatConversation` and `ChatMessage`, `Setting`, `NewsletterSubscriber`, `AuditLog`. `Product.sellerId` is reserved for the marketplace phase.

## 3. Payment provider comparison

| | Stripe (chosen) | Shopify Payments | PayPal |
|---|---|---|---|
| Works with a custom-built site | Excellent | Only within Shopify | Good |
| Apple Pay / Google Pay | Yes | Yes | Partial |
| Marketplace payouts to sellers | Stripe Connect | Needs third-party apps | PayPal for Marketplaces (eligibility-gated) |
| GBP + USD | Yes | Yes | Yes |

Stripe Checkout hosts the card form, so card data never reaches our servers. This keeps the PCI scope at SAQ A. PayPal can be added later as an extra payment method.

## 4. Status of the original brief

**Done and tested in this phase:**
- Storefront and departments
- Filters, sorting and search
- Product pages with variants
- Wishlist and bag
- Guest checkout with UK/US address validation
- Stripe Checkout and the webhook flow
- Discount codes
- Delivery rules for UK and US
- Order tracking
- Policy page templates
- SEO: sitemap, robots, canonical URLs, Product JSON-LD, and noindex on filtered pages
- Light and dark mode
- AI + human chat with WhatsApp handoff
- Admin dashboard: products, bulk pricing, categories, discounts, orders, chats, settings, staff roles, audit log
- Newsletter sign-up with consent

**Not built yet (next phases):**

| Phase | Scope |
|---|---|
| 2 | **Customer accounts:** registration, email verification, saved addresses, order history, returns requests, data export and deletion requests. **Transactional emails:** order confirmation, dispatch and back-in-stock, through a provider such as Resend or Postmark. |
| 3 | **Object storage + CDN** for product images (S3/R2), CSV product import and export, scheduled publishing. |
| 4 | **Multi-vendor marketplace:** seller applications, Stripe Connect onboarding (verification and payouts handled by Stripe, not stored by us), product approval workflow, commission ledger, payout reconciliation, seller dashboard. |
| 5 | Product reviews, back-in-stock alerts, abandoned-cart emails (with consent), consent-based analytics, admin MFA, Redis for rate limiting across multiple servers. |
| 6 | US expansion hardening: sales tax (e.g. Stripe Tax), US-specific privacy notices and product-safety checks. |

## 5. Compliance checklist (for review by a qualified adviser — not legal advice)

- [ ] Company name, registration number, registered address and VAT number entered in Admin → Site settings (shown in the footer)
- [ ] Privacy policy, cookie policy, terms and returns pages reviewed and completed. They are templates and marked as such.
- [ ] UK GDPR / DPA 2018: lawful basis recorded; data retention periods confirmed; processor agreements signed with Stripe, Google (Gemini API — note the free tier may use prompts to improve Google products; use a paid tier if that is not acceptable) and your host
- [ ] PECR: marketing emails only with consent (built in). Add a consent banner before adding any analytics or advertising cookies.
- [ ] Consumer Contracts Regulations: 14-day cancellation information (in the template) and pre-contract information at checkout
- [ ] Consumer Rights Act 2015: process for faulty goods
- [ ] Children's clothing: product safety (e.g. drawstrings, small parts, flammability for nightwear) and textile fibre labelling verified with suppliers
- [ ] Prices and promotions: sale prices are genuine reductions from a price actually charged
- [ ] VAT registration and treatment confirmed; US sales-tax obligations assessed before selling to the US
- [ ] Accessibility (WCAG 2.2 AA): semantic HTML, keyboard focus and labels are in place. Do a manual audit with real product photography.

## 6. Launch checklist

- [ ] Stripe account verified; payout bank account confirmed; live keys and live webhook configured
- [ ] Test order paid, refunded and reconciled in test mode; then one small live order
- [ ] Domain connected with HTTPS; `SITE_URL` set
- [ ] Production database backups enabled, and a restore tested
- [ ] `SESSION_SECRET` set to a new random value; admin password changed after the first login
- [ ] WhatsApp number and support email set; chat tested end-to-end
- [ ] Real products, photos, measurements and stock loaded; sample products deleted
- [ ] Legal pages reviewed (section 5)
- [ ] Mobile checkout tested on iOS and Android
- [ ] Error monitoring (e.g. Sentry) and uptime alerts configured
