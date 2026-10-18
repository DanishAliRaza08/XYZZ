# Fashion Rockstar LTD — Online Clothing Store

A UK-first online shop for children's, women's, men's and baby clothing, school kit, footwear and festival outfits.

**Contents**
1. [What's in the shop](#1-whats-in-the-shop)
2. [Run it on your computer](#2-run-it-on-your-computer)
3. [Daily use (admin)](#3-daily-use-admin)
4. [Menu, categories and pages](#4-menu-categories-and-pages) — how to add pages to Boys, Girls, Footwear…
5. [Seasonal events (Halloween, Christmas…)](#5-seasonal-events)
6. [Import products from a Shopify store](#6-import-products-from-a-shopify-store)
7. [Set up payments (Stripe)](#7-set-up-payments-stripe)
8. [Put it live on the internet](#8-put-it-live-on-the-internet)
9. [Project structure — which file does what](#9-project-structure--which-file-does-what)
10. [Development](#10-development)

See [`docs/PLAN.md`](docs/PLAN.md) for the research, architecture, compliance checklist and the roadmap of later phases (customer accounts, emails, marketplace and so on).

---

## 1. What's in the shop

- **Storefront** — homepage, a menu with dropdowns (Boys, Girls, Men, Women, School & Stationery, Festival Special, Footwear, More, Sale), category pages with filters, search, product pages, wishlist, bag, guest checkout, order tracking and policy pages.
- **Customer accounts (optional)** — customers can create an account (person icon in the header) to see their past orders, have their delivery address filled in at checkout and **save cards** for next time. Guest checkout still works without an account.
- **Photos per colour** — tag each product photo with a colour (e.g. a white skirt photo → "White"). When a shopper picks White, the white photos become the main images, and the bag shows the white photo too.
- **Shop by department** — picture cards on the homepage with a description, quick links and a button for each department. Change the picture, text and button in Admin → Site settings.
- **Light and dark mode** — follows the visitor's device setting, with a toggle in the header that is remembered.
- **Card payments on the checkout page** — customers type their card details into a secure Stripe card form on our own checkout page and pay without leaving the site (Apple Pay and Google Pay too, when switched on in Stripe). GBP for the UK and USD for the US.
- **Seasonal events** — switch on Halloween, Christmas or your own event and the whole site changes: a bar at the top of every page, themed colours, falling bats or snow, and a homepage banner, promo pictures and product section you control.
- **Chat assistant** — Google Gemini (free tier) answers questions using your live catalogue and policies. "Talk to a person" hands the chat to your team, who can reply inside the website or continue on **your WhatsApp number**.
- **Admin dashboard** at `/admin`, behind a staff login: products, sizes and colours, stock, photos, **all pricing on one page**, sale percentages, categories, discount codes, orders, customer chats, seasonal events, homepage content, delivery charges, staff roles and the audit log.

---

## 2. Run it on your computer

Requirements: Node.js 20+ and MySQL 8 (or MariaDB 10.6+). On Windows, the free MySQL Installer or XAMPP gives you a local MySQL server.

```bash
npm install
cp .env.example .env        # then edit .env (see below)
npx prisma migrate deploy   # creates the database tables
npm run import:products     # downloads the product catalogue + photos (see section 6)
npm run db:seed             # creates your admin login, all categories, the products and the Halloween/Christmas events
npm run dev                 # http://localhost:3000
```

Sign in to the admin at **http://localhost:3000/admin** with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

The seed is safe to run again at any time: it adds anything missing and leaves your existing products, categories and events alone. It also removes the placeholder sample products that earlier versions created. Imported products are published straight away; to import them hidden for review, run `SEED_PRODUCT_STATUS=DRAFT npm run db:seed`.

### Environment variables (`.env`)

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | MySQL connection string: `mysql://USER:PASSWORD@HOST:3306/DATABASE_NAME`. Special characters in the password must be URL-encoded (`@` → `%40`) |
| `SITE_URL` | Public address, e.g. `https://www.yourdomain.co.uk`. Used for Stripe redirects and the sitemap |
| `SESSION_SECRET` | Long random string (at least 16 characters) that signs admin and customer sign-ins (`openssl rand -hex 32`). Without it the shop still works, but admin login and customer accounts don't |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Your owner account. Re-running the seed resets this password |
| `STRIPE_SECRET_KEY` | From Stripe Dashboard → Developers → API keys (`sk_test_…` while testing). Keep it secret |
| `STRIPE_PUBLISHABLE_KEY` | From the same page (`pk_test_…` while testing). Safe to show in the browser; it loads the card form |
| `STRIPE_WEBHOOK_SECRET` | From the webhook endpoint you create (`whsec_…`) |
| `GEMINI_API_KEY` | Turns on AI chat replies. Get a free key at [Google AI Studio](https://aistudio.google.com/apikey). Without it, the chat still works and routes customers to your team |
| `GEMINI_MODEL` | Optional. Pins a Gemini model, e.g. `gemini-2.5-flash`. Defaults to `gemini-flash-latest`, Google's current Flash model |
| `SUPPORT_WHATSAPP_NUMBER` | Your WhatsApp number in international format, digits only (e.g. `447700900123`). Can also be set in Admin → Site settings |
| `UPLOAD_DIR` | Where photos uploaded in the admin are stored |

Secrets stay on the server. They are never sent to the browser and `.env` is git-ignored.

---

## 3. Daily use (admin)

| Task | Where |
|---|---|
| Add a product (name, description, prices, sizes/colours/stock, photos) | Admin → Products → **New product** |
| Copy all products from another Shopify shop (e.g. a supplier) | Admin → **Import products** — see [section 6](#6-import-products-from-a-shopify-store) |
| Show the right photo for each colour (white skirt photo when "White" is picked) | Admin → Products → the product → **Photos**: set each photo's colour (see below) |
| Change prices for many products at once, put items on sale, end a sale | Admin → **Pricing** |
| Add or rename a category (e.g. "Onesies") | Admin → Categories — see [section 4](#4-menu-categories-and-pages) |
| Make a discount code | Admin → Discount codes |
| See and fulfil orders, add tracking | Admin → Orders |
| Answer customers who asked for a person | Admin → **Customer chats** (badge shows new chats) |
| Halloween / Christmas / sale takeover: top bar, colours, homepage banner, promo pictures | Admin → **Seasonal events** |
| Change the "Shop by department" pictures, text and buttons | Admin → Site settings → **Shop by department tiles** |
| Change homepage banner, announcement bar, delivery charges, WhatsApp number | Admin → Site settings |
| Give staff limited access (e.g. customer service only) | Admin → Staff |

**Where a product appears.** Each product has a **department** (Boys, Girls, Men, Women, Baby), a **category** (e.g. Hoodies & sweatshirts) and an optional **Collection / edit** word (e.g. `Halloween`, `Eid`). The menu pages pick products using these three fields, so a "Boys" + "Footwear" product shows under Boys → Shoes & trainers *and* Footwear → Boys' shoes.

**Photos per colour.** In a product's **Photos** box, every photo has a colour dropdown listing the colours from *Sizes, colours & stock*:
- Set the white skirt photos to **White** and the black ones to **Black**. When a shopper taps the white swatch, the white photos move to the front (the first is the big main image) and the black ones are hidden. The bag and checkout show the photo of the colour that was bought.
- Leave photos that suit every colour (size chart, fabric close-up) on **All colours** — they always show, after the colour photos.
- To upload several photos for one colour, pick the colour in the dropdown next to **Upload photos** first — the button changes to e.g. *Upload White photos* and every new photo is tagged White.
- The product's first photo is still the one used in product grids, so put your best photo first.

**Customer accounts.** Customers sign up at `/account/register` (or from the link on the checkout page) and sign in at `/account/login`. **My account** (`/account`) shows their orders (placed while signed in), their saved cards with a *Remove* button, and their delivery address, which is saved from their last order and filled in at checkout. Passwords are stored encrypted (bcrypt). Cards are saved **by Stripe**, never in our database — see [section 7](#7-set-up-payments-stripe).

**How the chat reaches you.** When a customer taps *Talk to a person*:
1. The conversation is flagged in **Admin → Customer chats**. Your reply appears live in the customer's chat window.
2. The customer also gets a **Continue on WhatsApp** button. It opens WhatsApp to your number with a message that already contains their chat reference, so you can match the two.
3. If you've set a phone number in settings, a **Call us** button appears too.

---

## 4. Menu, categories and pages

The whole menu — every top item, its dropdown, the pages behind each link and the homepage "Shop by department" cards — is defined in **one file: [`src/lib/navigation.ts`](src/lib/navigation.ts)**. The categories it links to are listed in [`src/lib/categories.ts`](src/lib/categories.ts).

### How it's organised

| Term | What it is | Web address |
|---|---|---|
| **Section** | A top menu item, e.g. *Boys* or *Footwear* | `/shop/boys`, `/shop/footwear` |
| **Page** | A link inside a section's dropdown, e.g. *Hoodies & sweatshirts* | `/shop/boys/hoodies` |
| **Filter** | Which products a section or page shows: a `department`, and/or any of some `categories`, and/or any of some `collections` | — |

A page's filter is laid on top of its section's filter. In *Boys* the section filter is `{ department: "BOYS" }`, so a page only needs `{ categories: ["hoodies"] }` to show boys' hoodies.

Each section page shows the section's description and chips linking to all its pages, so customers can move between them.

### Option A — no code: create a category in the admin

1. **Admin → Categories → add** e.g. *Onesies* (URL `onesies`).
2. Give some products that category (Admin → Products → edit → Category) and publish them.
3. Done. In every department that has products in the new category, it appears automatically in the dropdown under **"More in Boys"** (or Girls, Men, Women), with its own page at `/shop/boys/onesies`.

### Option B — add a page to a dropdown (edit `src/lib/navigation.ts`)

Find the section, then add a line to one of its `columns[].pages` lists:

```ts
// In the "boys" section → columns → "Clothing" → pages:
cat("hoodies", "Hoodies & sweatshirts"),
cat("onesies", "Onesies"),            // ← new: lists BOYS products in the "onesies" category
```

`cat(categorySlug, label)` is a shortcut for "a page showing one category". For anything else, write the page out in full:

```ts
// A page under Festival Special listing products whose Collection is "Ramadan":
{ slug: "ramadan", label: "Ramadan", filter: { categories: [], collections: ["Ramadan"] } },

// A page under Footwear listing only girls' footwear:
{ slug: "girls", label: "Girls' shoes", filter: { department: "GIRLS" } },

// A page listing two categories at once:
{ slug: "bags-stationery", label: "Bags & stationery", filter: { categories: ["stationery", "accessories"] } },
```

- `slug` becomes the end of the web address (lowercase letters, numbers and dashes) and must be unique within its section.
- Categories must exist in the database: add new ones to `src/lib/categories.ts` and run `npm run db:seed`, or create them in Admin → Categories.
- `categories: []` clears the section's categories, so the page shows only the collections you list.
- To link to something that isn't a product list (e.g. *New in*), add `{ label, href }` to the column's `links` list instead.

### Option C — add a new top-level menu item

Add a new entry to the `SECTIONS` list in `src/lib/navigation.ts` (copy an existing one). Items appear in the menu in the order they're listed, followed by **Sale**:

```ts
{
  slug: "gifts",                                   // → /shop/gifts
  label: "Gifts",                                  // menu text
  description: "Gift ideas for birthdays and new babies.",
  filter: { collections: ["Gifts"] },              // products whose Collection is "Gifts"
  columns: [
    { title: "By age", pages: [
      { slug: "baby", label: "For babies", filter: { department: "BABY" } },
      { slug: "kids", label: "For kids", filter: { collections: ["Gifts"] } },
    ] },
  ],
  promo: { title: "Gift wrapping", text: "Add a note at checkout.", href: "/shop/gifts", cta: "Shop gifts" }, // optional box on the right of the dropdown
  tile: { image: "/images/departments/gifts.jpg", button: "Shop gifts" },                                      // optional homepage card
},
```

### Homepage "Shop by department" cards

- Every section with a `tile` gets a card: picture, title, description, up to four quick links (from its first dropdown column) and a button.
- The default pictures are illustrations in [`public/images/departments/`](public/images/departments). Replace a file there, or upload your own photo per card in **Admin → Site settings → Shop by department tiles** (a 4:3 landscape photo looks best). You can also change each card's text and button label there; leave a field empty to use the default.
- To remove a card, delete the `tile` line from that section.

Run `npm test` after editing `navigation.ts`. The tests check that every page links to a real category and that no web addresses clash.

---

## 5. Seasonal events

Two events are created for you: *Halloween* (1–31 October) and *Christmas* (15 November – 26 December). Each one appears on the website automatically between its dates, as long as it is switched on. Manage them in **Admin → Seasonal events**.

- **Top bar** — the message and link shown above every page. Customers can close it.
- **Theme** — Halloween (orange and purple, falling bats, pumpkin artwork), Christmas (red and green, falling snow, tree artwork) or Custom (your own accent colour, e.g. for Black Friday). Light and dark mode both get matching colours.
- **Homepage banner** — title, text, button and an optional picture you upload.
- **Event shop section** — upload promo pictures with captions and links, and show products whose *Collection* field matches (e.g. `Halloween`). The product import tags Halloween, Christmas, Eid, Diwali and World Book Day items for you.

If two events overlap, the one that started most recently is shown. Switch an event off to return to the normal look straight away.

---

## 6. Import products from a Shopify store

### From the admin (easiest)

**Admin → Import products**: paste the shop's address (e.g. `https://gumandberries.co.uk`), choose Published or Draft, how many photos per product and the stock per size, then press **Start import**. The import runs on the server and the page shows its progress; you can leave the page and come back. Photos are saved with your other uploads (`UPLOAD_DIR`). Products already in the shop are left as they are (including your edits), so running it again later only adds new products. Only Shopify shops have the public product feed this needs.

### From your computer

`npm run import:products` copies a catalogue from a Shopify store's public product feed. By default it uses **https://gumandberries.co.uk**.
- Photos are saved in **`public/images/products/<product>/`** (up to 4 per product, resized to 1000px wide).
- Product details are saved in **`prisma/data/products.json`**. Then run `npm run db:seed` to add them to the shop.
- Re-running the seed skips products that already exist, so it's safe to run again after an import.

The import works out the department (boys/girls/men/women/baby), category (from the list in `src/lib/categories.ts`), collection (Halloween, Christmas, Eid, Diwali, World Book Day), sizes and colours, sale prices, and US prices (UK price × 1.3, ending in .99). Unisex kids' items go to Girls. Check everything in Admin → Products afterwards. **Stock levels:** the feed only says whether a size is in stock, so in-stock sizes get 10 units. Set your real stock in the admin.

Options: `npm run import:products -- https://other-shop.example --max-images 2 --limit 100 --stock 5 --usd-rate 0`

> Only import products and photos you have permission to sell and reuse, for example from your own store or a supplier that has licensed them to you.

---

## 7. Set up payments (Stripe)

### How a customer pays

1. **Checkout → details:** they enter their email, delivery address and delivery method, tick the terms box and press **Continue to payment**. The server re-checks the bag, prices, stock and discount, creates the order (status *Pending payment*) and asks Stripe to prepare a payment for the exact total.
2. **Checkout → card details:** a card form appears on the same page (card number, expiry, CVC, and billing country/postcode pre-filled from the delivery address). They press **Pay £…**.
   - If their bank wants extra security (3D Secure), a pop-up from the bank opens; once approved the payment finishes.
   - If the card is declined, a message explains why (e.g. "Your card has insufficient funds") and they can try another card straight away.
   - **Edit details** goes back to step 1 and cancels the unpaid order.
3. **Thank-you page:** the order is marked **Paid**, stock goes down and the bag is emptied. This happens as soon as Stripe confirms the payment — the thank-you page checks with Stripe directly, and Stripe's webhook confirms it again in the background.

**Signed-in customers and saved cards.** When a customer with an account checks out, the payment is linked to their own Stripe customer record. The card form then lists the cards they saved before (tap one and pay — just the CVC if the bank asks) and shows a **"Save payment details for future purchases"** tick box under a new card. Saved cards are kept by Stripe and listed (with *Remove*) on the customer's **My account** page. This needs no extra setup beyond the Stripe keys below. We only ever see the card brand, last 4 digits and expiry date. Saving bank account details for Direct Debit is not supported — customers pay by card (or Apple Pay / Google Pay).

**Card details never touch our server.** The card fields are Stripe's own secure fields embedded in our page (Stripe *Payment Element*), so card numbers go straight from the customer's browser to Stripe. That keeps Fashion Rockstar out of most PCI card-security paperwork (you'll fill in Stripe's short self-assessment, SAQ A). Never add your own card-number inputs.

### Setting it up

1. Create a Stripe account at stripe.com for Fashion Rockstar LTD. Complete business verification with your real company, director and bank details, and add the bank account that should receive payouts. Stripe decides eligibility based on where the company and its representatives are located, so confirm this first.
2. Put your **test** keys in `.env`: `STRIPE_SECRET_KEY` (`sk_test_…`) and `STRIPE_PUBLISHABLE_KEY` (`pk_test_…`), both from Stripe → Developers → API keys. Without both keys the checkout says card payments aren't available yet.
3. In Stripe → Developers → Webhooks, add an endpoint at `https://YOUR-DOMAIN/api/webhooks/stripe` with these events:
   `payment_intent.succeeded`, `payment_intent.canceled`, `charge.refunded`
   (plus `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` if you already had them — orders from the old hosted payment page still work).
   Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
   For local testing, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
4. Optional: in Stripe → Settings → Payment methods, choose what customers can use. Cards are on by default; switch on Apple Pay, Google Pay or Klarna and they appear in the same form automatically. For Apple Pay on your live site, also add your domain under Settings → Payment method domains.
5. Place test orders with these test cards (any future expiry date, any CVC, any postcode):

   | Card number | What happens |
   |---|---|
   | `4242 4242 4242 4242` | Payment succeeds |
   | `4000 0025 0000 3155` | Bank security check (3D Secure) pop-up, then succeeds |
   | `4000 0000 0000 9995` | Declined — insufficient funds |
   | `4000 0000 0000 0002` | Declined — generic decline |

   Check that a successful order shows **Paid** in Admin → Orders and that stock went down.
6. When everything works, switch to your **live** keys (`sk_live_…`, `pk_live_…`) and a live webhook endpoint.

Safeguards built in:
- Prices, stock, discounts and delivery are recalculated on the server. The browser only sends product IDs and quantities, and Stripe is asked to charge the server's total.
- An order is only marked paid after Stripe confirms it (signed webhook, or a direct check with Stripe's API) — never because the browser says so.
- Webhook signatures are verified, and repeated events are ignored.
- Stock can never go negative.
- If the amount paid doesn't match the order, or stock ran out, the order is flagged **Needs attention**.

Refunds are issued from the Stripe dashboard. A full refund switches the order to *Refunded* automatically.

---

## 8. Put it live on the internet

### On Hostinger (a plan with "Web Apps" — Unlimited or Cloud; Premium has no Node.js web apps)

1. **Database:** hPanel → **Databases → MySQL Databases** → create a database, a user and a password. Your `DATABASE_URL` is `mysql://USER:PASSWORD@localhost:3306/DATABASE_NAME` (hPanel shows the exact host if it isn't `localhost`).
2. **App:** hPanel → **Websites → Add website → Node.js web app** → connect GitHub (repository `XYZZ`, branch `main`) or upload the ZIP.
   - Framework: Next.js · Node.js version: 20 or newer · Package manager: npm · Output directory: `.next`
   - Build command: `npm run build`. It creates/updates the database tables, creates your admin login, categories and seasonal events on the first deploy (an admin password you later change is kept), then builds the site.
3. **Environment variables:** add every variable from `.env.example` in the app's settings (not a `.env` file). Use a new random `SESSION_SECRET`, and set `SITE_URL` to `https://your-domain`. `ADMIN_EMAIL` and `ADMIN_PASSWORD` (10+ characters) are your admin login.
4. **Deploy**, then sign in at `https://your-domain/admin`.
5. **Stripe:** add the webhook endpoint `https://your-domain/api/webhooks/stripe` (section 7) and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
6. **Uploaded photos:** after your first redeploy, check a photo uploaded in the admin still shows. If redeploys wipe `storage/uploads`, set `UPLOAD_DIR` to a folder outside the app folder.

### Anywhere else

1. **Database:** any MySQL 8 / MariaDB 10.6+ database (Hostinger, PlanetScale, AWS RDS, a VPS…) with automatic backups.
2. **Hosting:** deploy this repository to a Node host such as Railway, Render or Fly.io, or use Docker on a VPS.
   - Build command: `npm ci && npm run build` (the build also applies database migrations)
   - Start command: `npm start`
   - Set every variable from `.env.example` in the host's settings.
   - Use persistent storage for `UPLOAD_DIR`, or move uploads to object storage (S3/R2). See the roadmap.
   - On Vercel/serverless, uploaded files are not kept, so use image URLs or add object storage first.
3. **Domain:** buy your domain, point its DNS at the host and turn on HTTPS (most hosts do this automatically). Set `SITE_URL` to the final https address.
4. Run `npm run db:seed` once in production to create your admin login, then sign in and change your password (Admin → My account).
5. Complete the launch checklist in `docs/PLAN.md` before switching Stripe to live mode.

### Why the live site is fast (and why `npm run dev` feels slow)

- `npm run dev` compiles each page the first time you open it, so pages take a few seconds on your computer. That's normal; the live site uses `npm run build` + `npm start`, which is many times faster.
- The catalogue, menu, settings and seasonal event are kept in the server's memory for up to a minute (`src/lib/cache.ts`), so page views don't re-read the database. Saving anything in the admin, or a paid order, refreshes it straight away.
- Product photos are served resized and compressed for each screen (Next.js image optimisation), not as full-size originals. Upload photos about 1200–1600px wide; bigger files only slow down the first visitor.

---

## 9. Project structure — which file does what

The app is built with **Next.js (App Router)**: every folder under `src/app` is a web address, and the `page.tsx` inside it is that page. Folders in brackets, like `(store)`, group pages without changing the address. `[slug]` means "any value here".

### Top level

| Path | What it does |
|---|---|
| `package.json` | Dependencies and the `npm run …` commands |
| `.env.example` | Template for your `.env` settings file (section 2) |
| `next.config.mjs` | Next.js settings: allowed image hosts and security headers |
| `tsconfig.json` | TypeScript settings (`@/` means `src/`) |
| `vitest.config.mts` | Test runner settings |
| `docs/PLAN.md` | Research, architecture, launch checklist and roadmap |
| `public/` | Files served as-is: `public/images/departments/` (homepage card illustrations), `public/images/products/` (imported product photos) |

### Database — `prisma/`

| Path | What it does |
|---|---|
| `prisma/schema.prisma` | The database design: products, variants (size/colour/stock), categories, orders, chats, seasonal events, settings, staff, audit log |
| `prisma/migrations/` | Step-by-step database changes (MySQL), applied with `npx prisma migrate deploy`. Never edit old ones; create new ones with `npx prisma migrate dev` |
| `prisma/seed.ts` | `npm run db:seed`: creates the admin login, every category, the imported products and the starter events |
| `prisma/data/products.json` | Created by the product import; read by the seed |

### Scripts — `scripts/`

| Path | What it does |
|---|---|
| `scripts/import-shopify.ts` | `npm run import:products`: downloads products and photos from a Shopify store (section 6) |

### Shop pages — `src/app/(store)/`

| Path | Web address | What it does |
|---|---|---|
| `layout.tsx` | every shop page | Header (logo, menu with dropdowns, search, wishlist, bag), event bar, announcement bar, newsletter, footer, chat button |
| `page.tsx` | `/` | Homepage: banner (or the live event's), event shop, Shop by department cards, featured, collections, bestsellers |
| `shop/[...slug]/page.tsx` | `/shop/…` | Every product list: menu sections and pages (`/shop/boys/hoodies`), collections (`/shop/sale`, `/shop/new-arrivals`, `/shop/bestsellers`) and admin-created categories |
| `product/[slug]/page.tsx` | `/product/…` | Product page: photos, price, size/colour picker, add to bag, related products |
| `search/page.tsx` | `/search?q=…` | Search results |
| `bag/page.tsx` | `/bag` | Shopping bag |
| `checkout/page.tsx` | `/checkout` | Delivery details, then the card form — the customer pays on this page |
| `checkout/success/page.tsx` | `/checkout/success` | Thank-you page; checks the payment with Stripe and marks the order paid |
| `order-status/page.tsx` | `/order-status` | Customers track an order with its number and email |
| `account/page.tsx` | `/account` | My account: orders, saved cards (remove), delivery address, sign out |
| `account/login/page.tsx`, `account/register/page.tsx` | `/account/login`, `/account/register` | Customer sign in and sign up |
| `account/actions.ts` | — | Sign up, sign in, sign out and removing a saved card |
| `wishlist/page.tsx` | `/wishlist` | Saved items (stored in the customer's browser) |
| `about`, `contact`, `faq`, `delivery-returns`, `size-guide`, `privacy`, `cookies`, `terms` | `/about` … | Information and policy pages — edit the text in each `page.tsx` |
| `not-found.tsx` | — | The "page not found" page |

### Admin pages — `src/app/admin/`

| Path | What it does |
|---|---|
| `login/page.tsx` | Staff sign-in |
| `(panel)/layout.tsx` | Admin sidebar menu; checks the user is signed in and which sections their role can see |
| `(panel)/page.tsx` | Dashboard: sales and orders that need attention |
| `(panel)/products/…` | Product list, new product, edit product |
| `(panel)/pricing/page.tsx` | Edit all prices on one page, bulk sales |
| `(panel)/categories/page.tsx` | Add, rename and delete categories |
| `(panel)/discounts/page.tsx` | Discount codes |
| `(panel)/orders/…` | Order list and order details (status, tracking) |
| `(panel)/chats/page.tsx` | Customer chats that asked for a person |
| `(panel)/events/…` | Seasonal events: list, new, edit |
| `(panel)/settings/page.tsx` | Site settings: support contacts, homepage banner, Shop by department cards, delivery charges, company details |
| `(panel)/staff/page.tsx` | Staff accounts and roles |
| `(panel)/account/page.tsx` | Change your own password |
| `actions.ts` | Everything the admin forms save (products, prices, categories, events, settings…). Each action checks permissions, validates input and writes an audit log entry |

### Behind-the-scenes addresses — `src/app/api/` and others

| Path | What it does |
|---|---|
| `api/cart/quote/route.ts` | Works out bag totals, discounts and delivery on the server |
| `api/checkout/route.ts` | Step 1 of checkout: checks the bag and details, creates the order and a Stripe payment for the exact total |
| `api/checkout/cancel/route.ts` | "Edit details" on the payment step: cancels the unpaid order and its Stripe payment |
| `api/webhooks/stripe/route.ts` | Stripe tells us a payment succeeded, was cancelled or was refunded; marks orders paid and reduces stock |
| `api/chat/route.ts` | Chat messages; gets the Gemini assistant's reply |
| `api/chat/handoff/route.ts` | "Talk to a person": hands the chat to staff |
| `api/newsletter/route.ts` | Newsletter sign-ups (with consent) |
| `api/stock/route.ts` | Live stock for a size/colour |
| `api/products/by-slug/route.ts` | Product details for the wishlist page |
| `api/admin/upload/route.ts` | Photo uploads from the admin (checks the file really is an image) |
| `uploads/[name]/route.ts` | Serves uploaded photos at `/uploads/…` |
| `layout.tsx` | The outer HTML page, fonts and light/dark mode script |
| `globals.css` | All styling: colours (design tokens), layout, components, event themes |
| `icon.svg`, `apple-icon.png`, `favicon.ico` | The FR logo shown in browser tabs and on phone home screens — replace these files to change it |
| `sitemap.ts` / `robots.ts` | `/sitemap.xml` and `/robots.txt` for search engines |

### Shared building blocks — `src/components/`

| File | What it does |
|---|---|
| `HeaderClient.tsx` | Interactive header parts: mobile menu, search box, wishlist and bag counters |
| `Listing.tsx` | A product list page: title, sub-page chips, filters (size, colour, price, stock), sorting, pagination |
| `ProductCard.tsx` | One product tile in a grid: photo, name, price, colours, sale/new labels |
| `ShopImage.tsx` | Shows a photo resized for the screen (used for product, banner and homepage photos) |
| `ProductPurchase.tsx` | Size and colour picker with add to bag / wishlist, and the photo gallery that switches to the chosen colour's photos |
| `AccountForms.tsx` | Customer sign-in and sign-up forms |
| `BagAndCheckout.tsx` | The bag and the two-step checkout (details, then card payment) |
| `CardPayment.tsx` | The card form (Stripe Payment Element) styled to match the shop, with the Pay button and decline messages |
| `StoreProvider.tsx` | Remembers the bag and wishlist in the browser |
| `ChatWidget.tsx` | The chat bubble and window |
| `EventBar.tsx` / `EventDecor.tsx` | Seasonal event bar (closable) and falling bats/snow |
| `ThemeToggle.tsx` | Light/dark mode button |
| `CurrencySwitcher.tsx` | UK £ / US $ switch |
| `NewsletterForm.tsx` | Newsletter sign-up box |
| `AutoSubmitForm.tsx` | Makes filters apply as soon as you tick them |
| `InfoPage.tsx` | Layout for the information/policy pages |
| `WishlistView.tsx`, `ProductArtClient.tsx`, `Icons.tsx` | Wishlist list, photo placeholder, icons |
| `admin/ProductForm.tsx` | The product editor (details, prices, variants, photos) |
| `admin/EventForm.tsx` | The seasonal event editor |
| `admin/DepartmentTileFields.tsx` | Picture/text/button fields for the homepage cards in Site settings |
| `admin/ActionForm.tsx` | Admin form wrapper that shows "Saved" / error messages |
| `admin/AdminNav.tsx`, `admin/LoginForm.tsx` | Admin sidebar links and the sign-in form |

### Logic — `src/lib/`

| File | What it does |
|---|---|
| `navigation.ts` | **The menu**: sections, dropdown pages, filters, homepage cards (section 4) |
| `navigation-server.ts` | Builds the header menu, adding admin-created categories under "More in …" |
| `categories.ts` | The master list of categories |
| `catalog.ts` | Finding products: listing, filtering, sorting, departments, collections |
| `events.ts` | Which seasonal event is live, theme helpers |
| `settings.ts` | Site settings (banner, contacts, delivery, homepage cards) with defaults |
| `pricing.ts` | Regular/sale prices per currency, discounts, delivery charges |
| `money.ts` | Formatting and reading prices (stored as pence/cents) |
| `quote.ts` | Bag totals checked against live prices and stock |
| `orders.ts` | Creating orders, marking them paid (stock-safe) and confirming a card payment with Stripe for the thank-you page |
| `checkout-schema.ts` | Rules for valid checkout details |
| `stripe.ts` | Stripe connection, the publishable key and the site address |
| `chat.ts` | The Gemini chat assistant and the store information it's given |
| `chat-store.ts` | Loading and saving chat conversations |
| `auth.ts` / `session.ts` | Staff sign-in, roles and permissions; signed sign-in cookies for staff and customers |
| `shopify-import.ts` | Reads a Shopify shop's product feed and maps its products, prices, sizes and photos to ours |
| `import-job.ts` | Runs Admin → Import products in the background and reports progress |
| `customer.ts` | Customer accounts: who is signed in, their Stripe customer and saved cards |
| `photos.ts` | Picks which product photos to show for the chosen colour |
| `uploads.ts` | Where uploads are stored; image type checks |
| `cache.ts` | Keeps catalogue, menu, settings and events in memory for a minute; cleared on admin saves and paid orders |
| `rate-limit.ts` | Stops too many requests from one visitor |
| `currency-server.ts` | Reads the visitor's chosen currency |
| `db.ts` | The database connection |

### Tests — `tests/`

| File | What it checks |
|---|---|
| `pricing.test.ts` | Prices, sales, discounts, delivery |
| `checkout-schema.test.ts` | Checkout validation |
| `session.test.ts` | Admin and customer login tokens |
| `product-import.integration.test.ts` | Admin → Import products with a fake shop: new products, photos, re-runs, bad addresses |
| `catalog-cache.test.ts` | Catalogue search and filters, and the memory cache |
| `photos.test.ts` | Photos per colour: which photos show for each colour |
| `card-payment.integration.test.ts` | Card payments, guest and signed-in (saved cards, order on the account), with a fake Stripe (runs when `DATABASE_URL` is set) |
| `navigation.test.ts` | The menu config is valid (real categories, no clashing addresses) |
| `import-and-events.test.ts` | Product import sorting rules and event helpers |
| `orders.integration.test.ts` | Orders and stock against a real database (runs when `DATABASE_URL` is set) |

---

## 10. Development

```bash
npm run typecheck   # TypeScript
npm test            # unit tests + database integration tests (when DATABASE_URL is set)
npm run build       # production build
```

Tech stack: Next.js 15 (App Router) · React 19 · TypeScript · MySQL + Prisma · Stripe (Payment Element + PaymentIntents) · Google Gemini API (REST, no SDK) · plain CSS design tokens for theming.
