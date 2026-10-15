# Fashion Rockstar LTD — Online Clothing Store

A UK-first clothing store for women's, children's and baby clothing. It includes:

- **Storefront** — homepage, departments, categories, filters, search, product pages, wishlist, bag, guest checkout, order tracking and policy pages.
- **Light and dark mode** — follows the visitor's device setting, with a toggle in the header that is remembered.
- **Stripe payments** — GBP for the UK and USD for the US. Orders are only marked paid by a signed Stripe webhook.
- **Chat assistant** — Claude answers questions using your live catalogue and policies. "Talk to a person" hands the chat to your team, who can reply inside the website or continue on **your WhatsApp number**.
- **Admin dashboard** at `/admin`, behind a staff login. You can manage products, sizes and colours, stock, photos, **all pricing on one page**, sale percentages, categories, discount codes, orders, customer chats, homepage content, delivery charges, staff roles and the audit log.

See [`docs/PLAN.md`](docs/PLAN.md) for the research, architecture, compliance checklist and the roadmap of later phases (customer accounts, multi-vendor marketplace and so on).

---

## 1. Run it on your computer

Requirements: Node.js 20+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env        # then edit .env (see below)
npx prisma migrate deploy   # creates the database tables
npm run db:seed             # creates your admin login + starter categories + sample products (as drafts)
npm run dev                 # http://localhost:3000
```

Sign in to the admin at **http://localhost:3000/admin** with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

The sample products are created as **drafts** with placeholder artwork so the shop isn't empty. Publish them to try the shop, or delete them and add your own. To publish them while seeding, run `SEED_PUBLISH_SAMPLES=1 npm run db:seed`.

### Environment variables (`.env`)

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SITE_URL` | Public address, e.g. `https://www.yourdomain.co.uk`. Used for Stripe redirects and the sitemap |
| `SESSION_SECRET` | Long random string that signs admin logins (`openssl rand -hex 32`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Your owner account. Re-running the seed resets this password |
| `STRIPE_SECRET_KEY` | From Stripe Dashboard → Developers → API keys (`sk_test_…` while testing) |
| `STRIPE_WEBHOOK_SECRET` | From the webhook endpoint you create (`whsec_…`) |
| `ANTHROPIC_API_KEY` | Turns on AI chat replies. Without it, the chat still works and routes customers to your team |
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
| Change homepage banner, announcement bar, delivery charges, WhatsApp number | Admin → Site settings |
| Give staff limited access (e.g. customer service only) | Admin → Staff |

**How the chat reaches you.** When a customer taps *Talk to a person*:
1. The conversation is flagged in **Admin → Customer chats**. Your reply appears live in the customer's chat window.
2. The customer also gets a **Continue on WhatsApp** button. It opens WhatsApp to your number with a message that already contains their chat reference, so you can match the two.
3. If you've set a phone number in settings, a **Call us** button appears too.

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

Tech stack: Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL + Prisma · Stripe Checkout · Claude API (`@anthropic-ai/sdk`) · plain CSS design tokens for theming.
