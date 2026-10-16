# Fashion Rockstar LTD — Online Clothing Store

A UK-first clothing store for women's, children's and baby clothing. It includes:

- **Storefront** — homepage, departments, categories, filters, search, product pages, wishlist, bag, guest checkout, order tracking and policy pages.
- **Light and dark mode** — follows the visitor's device setting, with a toggle in the header that is remembered.
- **Stripe payments** — GBP for the UK and USD for the US. Orders are only marked paid by a signed Stripe webhook.
- **Seasonal events** — Halloween, Christmas, Black Friday… Switch an event on (or give it dates) in the admin and the whole site changes: a bar at the top of every page, Halloween or Christmas colours, falling bats or snow, and a homepage banner, promo pictures and product section you control.
- **Chat assistant** — Google Gemini (free tier) answers questions using your live catalogue and policies. "Talk to a person" hands the chat to your team, who can reply inside the website or continue on **your WhatsApp number**.
- **Admin dashboard** at `/admin`, behind a staff login. You can manage products, sizes and colours, stock, photos, **all pricing on one page**, sale percentages, categories, discount codes, orders, customer chats, **seasonal events**, homepage content, delivery charges, staff roles and the audit log.

See [`docs/PLAN.md`](docs/PLAN.md) for the research, architecture, compliance checklist and the roadmap of later phases (customer accounts, multi-vendor marketplace and so on).

---

## 1. Run it on your computer

Requirements: Node.js 20+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env        # then edit .env (see below)
npx prisma migrate deploy   # creates the database tables
npm run import:products     # downloads the product catalogue + photos (see section 2a)
npm run db:seed             # creates your admin login, categories, the products and the Halloween/Christmas events
npm run dev                 # http://localhost:3000
```

Sign in to the admin at **http://localhost:3000/admin** with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

The seed also removes the placeholder sample products that earlier versions created. Imported products are published straight away; to import them hidden for review, run `SEED_PRODUCT_STATUS=DRAFT npm run db:seed`.

### Environment variables (`.env`)

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SITE_URL` | Public address, e.g. `https://www.yourdomain.co.uk`. Used for Stripe redirects and the sitemap |
| `SESSION_SECRET` | Long random string that signs admin logins (`openssl rand -hex 32`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Your owner account. Re-running the seed resets this password |
| `STRIPE_SECRET_KEY` | From Stripe Dashboard → Developers → API keys (`sk_test_…` while testing) |
| `STRIPE_WEBHOOK_SECRET` | From the webhook endpoint you create (`whsec_…`) |
| `GEMINI_API_KEY` | Turns on AI chat replies. Get a free key at [Google AI Studio](https://aistudio.google.com/apikey). Without it, the chat still works and routes customers to your team |
| `GEMINI_MODEL` | Optional. Pins a Gemini model, e.g. `gemini-2.5-flash`. Defaults to `gemini-flash-latest`, Google's current Flash model |
| `SUPPORT_WHATSAPP_NUMBER` | Your WhatsApp number in international format, digits only (e.g. `447700900123`). Can also be set in Admin → Site settings |
| `UPLOAD_DIR` | Where uploaded product photos are stored |

Secrets stay on the server. They are never sent to the browser and `.env` is git-ignored.

---

## 2. Daily use (admin)

| Task | Where |
|---|---|
| Add a product (name, description, prices, sizes/colours/stock, photos) | Admin → Products → **New product** |
| Change prices for many products at once, put items on sale, end a sale | Admin → **Pricing** |
| Make a discount code | Admin → Discount codes |
| See and fulfil orders, add tracking | Admin → Orders |
| Answer customers who asked for a person | Admin → **Customer chats** (badge shows new chats) |
| Halloween / Christmas / sale takeover: top bar, colours, homepage banner, promo pictures | Admin → **Seasonal events** |
| Change homepage banner, announcement bar, delivery charges, WhatsApp number | Admin → Site settings |
| Give staff limited access (e.g. customer service only) | Admin → Staff |

**Seasonal events.** Two events are created for you: *Halloween* (1–31 October) and *Christmas* (15 November – 26 December). Each one appears on the website automatically between its dates, as long as it is switched on.
- **Top bar** — the message and link shown above every page. Customers can close it.
- **Theme** — Halloween (orange and purple, falling bats, pumpkin artwork), Christmas (red and green, falling snow, tree artwork) or Custom (your own accent colour). Light and dark mode both get matching colours.
- **Homepage banner** — title, text, button and an optional picture you upload.
- **Event shop section** — upload promo pictures with captions and links, and show products whose *Collection* field matches (e.g. `Halloween`). The product import tags Halloween and Christmas items for you.
If two events overlap, the one that started most recently is shown. Switch an event off to return to the normal look straight away.

**How the chat reaches you.** When a customer taps *Talk to a person*:
1. The conversation is flagged in **Admin → Customer chats**. Your reply appears live in the customer's chat window.
2. The customer also gets a **Continue on WhatsApp** button. It opens WhatsApp to your number with a message that already contains their chat reference, so you can match the two.
3. If you've set a phone number in settings, a **Call us** button appears too.

---

## 2a. Import products from a Shopify store

`npm run import:products` copies a catalogue from a Shopify store's public product feed. By default it uses **https://a2z4kids.co.uk**.
- Photos are saved in **`public/images/products/<product>/`** (up to 4 per product, resized to 1000px wide).
- Product details are saved in **`prisma/data/products.json`**. Then run `npm run db:seed` to add them to the shop.
- Re-running the seed skips products that already exist, so it's safe to run again after an import.

The import works out these details for you: department (girls/boys/baby…), category, sizes and colours, sale prices, and US prices (UK price × 1.3, ending in .99). Check them in Admin → Products afterwards. **Stock levels:** the feed only says whether a size is in stock, so in-stock sizes get 10 units. Set your real stock in the admin.

Options: `npm run import:products -- https://other-shop.example --max-images 2 --limit 100 --stock 5 --usd-rate 0`

> Only import products and photos you have permission to sell and reuse, for example from your own store or a supplier that has licensed them to you.

---

## 3. Set up payments (Stripe)

1. Create a Stripe account at stripe.com for Fashion Rockstar LTD. Complete business verification with your real company, director and bank details, and add the bank account that should receive payouts. Stripe decides eligibility based on where the company and its representatives are located, so confirm this first.
2. Put your **test** secret key in `STRIPE_SECRET_KEY`.
3. In Stripe → Developers → Webhooks, add an endpoint at `https://YOUR-DOMAIN/api/webhooks/stripe` with these events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
   Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
   For local testing, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
4. Place test orders with card `4242 4242 4242 4242`. Check that the order shows **Paid** in Admin → Orders and that stock went down.
5. When everything works, switch to your **live** keys and a live webhook endpoint.

Safeguards built in:
- Prices, stock, discounts and delivery are recalculated on the server. The browser only sends product IDs and quantities.
- Webhook signatures are verified, and repeated events are ignored.
- Stock can never go negative.
- If the amount paid doesn't match the order, or stock ran out, the order is flagged **Needs attention**.

Refunds are issued from the Stripe dashboard. A full refund switches the order to *Refunded* automatically.

---

## 4. Put it live on the internet

A simple, reliable setup:

1. **Database:** create a managed PostgreSQL database (for example Neon, Supabase, Railway or AWS RDS) and turn on automatic backups.
2. **Hosting:** deploy this repository to a Node host such as Railway, Render or Fly.io, or use Docker on a VPS.
   - Build command: `npm ci && npm run build && npx prisma migrate deploy`
   - Start command: `npm start`
   - Set every variable from `.env.example` in the host's settings.
   - Use persistent storage for `UPLOAD_DIR`, or move uploads to object storage (S3/R2). See the roadmap.
   - On Vercel/serverless, uploaded files are not kept, so use image URLs or add object storage first.
3. **Domain:** buy your domain, point its DNS at the host and turn on HTTPS (most hosts do this automatically). Set `SITE_URL` to the final https address.
4. Run `npm run db:seed` once in production to create your admin login, then sign in and change your password (Admin → My account).
5. Complete the launch checklist in `docs/PLAN.md` before switching Stripe to live mode.

---

## 5. Development

```bash
npm run typecheck   # TypeScript
npm test            # unit tests + database integration tests (when DATABASE_URL is set)
npm run build       # production build
```

Tech stack: Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL + Prisma · Stripe Checkout · Google Gemini API (REST, no SDK) · plain CSS design tokens for theming.
