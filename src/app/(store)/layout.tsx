import Link from "next/link";
import { ChatWidget } from "@/components/ChatWidget";
import { EventBar } from "@/components/EventBar";
import { EventDecor } from "@/components/EventDecor";
import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { BagLink, MobileMenuButton, SearchToggle, WishlistLink } from "@/components/HeaderClient";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getCurrency } from "@/lib/currency-server";
import { accentVars, getActiveEvent, themeSlug } from "@/lib/events";
import { SECTIONS, sectionHref } from "@/lib/navigation";
import { buildNav } from "@/lib/navigation-server";
import { getSettings } from "@/lib/settings";
import { NewsletterForm } from "@/components/NewsletterForm";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, currency, nav, event] = await Promise.all([getSettings(), getCurrency(), buildNav(), getActiveEvent()]);
  const year = new Date().getFullYear();
  return (
    <div
      className={event ? "event-scope" : undefined}
      data-event={event ? themeSlug(event.theme) : undefined}
      style={event ? (accentVars(event.accentColor) as React.CSSProperties) : undefined}
    >
      <a href="#main" className="skip-link">Skip to content</a>
      {event && (
        <EventBar
          storageKey={`event-bar:${event.id}:${event.updatedAt.getTime()}`}
          text={event.barText}
          linkLabel={event.barLinkLabel}
          linkHref={event.barLinkHref}
        />
      )}
      {event?.decorations && <EventDecor theme={event.theme} />}
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
                {item.columns && (
                  <div className="mega">
                    <div className="container mega-inner">
                      <div className="mega-intro">
                        <h3>{item.label}</h3>
                        {item.description && <p className="muted small">{item.description}</p>}
                        <Link href={item.href} className="btn btn-sm">Shop all {item.label}</Link>
                      </div>
                      <div className="mega-columns">
                        {item.columns.map((col) => (
                          <div key={col.title}>
                            <h4>{col.title}</h4>
                            {col.links.map((l) => (
                              <Link key={l.href} href={l.href}>{l.label}</Link>
                            ))}
                          </div>
                        ))}
                      </div>
                      {item.promo && (
                        <Link href={item.promo.href} className="mega-promo">
                          <strong>{item.promo.title}</strong>
                          <span>{item.promo.text}</span>
                          <span className="mega-promo-cta">{item.promo.cta} →</span>
                        </Link>
                      )}
                    </div>
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
                {SECTIONS.map((sec) => (
                  <li key={sec.slug}><Link href={sectionHref(sec)}>{sec.label}</Link></li>
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
    </div>
  );
}
