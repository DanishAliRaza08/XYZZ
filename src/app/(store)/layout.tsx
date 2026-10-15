import Link from "next/link";
import { ChatWidget } from "@/components/ChatWidget";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { BagLink, MobileMenuButton, SearchToggle, WishlistLink, type NavItem } from "@/components/HeaderClient";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DEPARTMENTS } from "@/lib/catalog";
import { getCurrency } from "@/lib/currency-server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { NewsletterForm } from "@/components/NewsletterForm";

export const dynamic = "force-dynamic";

async function buildNav(): Promise<NavItem[]> {
  const rows = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    select: { department: true, category: { select: { slug: true, name: true, sortOrder: true } } },
    distinct: ["department", "categoryId"],
  });
  const nav: NavItem[] = [{ label: "New in", href: "/shop/new-arrivals" }];
  for (const d of DEPARTMENTS) {
    const cats = rows
      .filter((r) => r.department === d.value)
      .map((r) => r.category)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    if (!cats.length) continue;
    const links = cats.map((c) => ({ label: c.name, href: `/shop/${d.slug}/${c.slug}` }));
    const half = Math.ceil(links.length / 2);
    nav.push({
      label: d.label,
      href: `/shop/${d.slug}`,
      groups: [
        { title: "Shop by category", links: links.slice(0, half) },
        { title: "More", links: links.slice(half) },
      ].filter((g) => g.links.length),
    });
  }
  nav.push({ label: "Bestsellers", href: "/shop/bestsellers" });
  nav.push({ label: "Sale", href: "/shop/sale", sale: true });
  return nav;
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, currency, nav] = await Promise.all([getSettings(), getCurrency(), buildNav()]);
  const year = new Date().getFullYear();
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      {settings.announcement && <div className="announcement">{settings.announcement}</div>}
      <header className="site-header">
        <div className="container header-inner" style={{ position: "relative" }}>
          <div className="header-left">
            <MobileMenuButton nav={nav} />
            <SearchToggle />
            <CurrencySwitcher current={currency} usEnabled={settings.usStoreEnabled} />
          </div>
          <Link href="/" className="logo" aria-label="Fashion Rockstar home">
            Fashion Rockstar
            <small>London · Est. 2024</small>
          </Link>
          <div className="header-actions">
            <ThemeToggle />
            <WishlistLink />
            <BagLink />
          </div>
        </div>
        <nav className="main-nav" aria-label="Main">
          <ul className="container">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={`nav-link${item.sale ? " nav-sale" : ""}`}>{item.label}</Link>
                {item.groups && (
                  <div className="mega">
                    {item.groups.map((g) => (
                      <div key={g.title}>
                        <h4>{g.title}</h4>
                        {g.links.map((l) => (
                          <Link key={l.href} href={l.href}>{l.label}</Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main">{children}</main>

      <section className="newsletter section">
        <div className="container">
          <span className="eyebrow">Newsletter</span>
          <h2>First look at new collections</h2>
          <p className="muted">Early access to new arrivals and seasonal edits. Unsubscribe at any time.</p>
          <NewsletterForm />
        </div>
      </section>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <div className="logo" style={{ textAlign: "left", fontSize: "1.3rem" }}>Fashion Rockstar</div>
              <p className="muted small" style={{ marginTop: 12 }}>
                Considered clothing for women and children, designed in Britain.
              </p>
              <div className="pay-icons" aria-label="Accepted payment methods">
                <span>VISA</span><span>Mastercard</span><span>AMEX</span><span>Apple Pay</span><span>Google Pay</span>
              </div>
            </div>
            <div>
              <h4>Shop</h4>
              <ul>
                {DEPARTMENTS.slice(0, 4).map((d) => (
                  <li key={d.slug}><Link href={`/shop/${d.slug}`}>{d.label}</Link></li>
                ))}
                <li><Link href="/shop/sale">Sale</Link></li>
              </ul>
            </div>
            <div>
              <h4>Help</h4>
              <ul>
                <li><Link href="/order-status">Track an order</Link></li>
                <li><Link href="/delivery-returns">Delivery & returns</Link></li>
                <li><Link href="/size-guide">Size guide</Link></li>
                <li><Link href="/faq">FAQs</Link></li>
                <li><Link href="/contact">Contact us</Link></li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li><Link href="/about">About us</Link></li>
                <li><Link href="/privacy">Privacy policy</Link></li>
                <li><Link href="/cookies">Cookie policy</Link></li>
                <li><Link href="/terms">Terms & conditions</Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-legal">
            <span>
              © {year} Fashion Rockstar LTD{settings.companyNumber ? ` · Registered in England & Wales No. ${settings.companyNumber}` : ""}
              {settings.vatNumber ? ` · VAT No. ${settings.vatNumber}` : ""}
              {settings.companyAddress ? ` · ${settings.companyAddress}` : ""}
            </span>
            <span>Prices {currency === "GBP" ? "include UK VAT" : "shown in USD; sales tax and duties may apply"}.</span>
          </div>
        </div>
      </footer>
      <ChatWidget hasPhone={Boolean(settings.whatsappNumber || settings.supportPhone)} />
    </>
  );
}
