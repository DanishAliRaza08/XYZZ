import { updateSettings } from "../../actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdminPage } from "@/lib/auth";
import { toInputValue } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export default async function SettingsAdmin() {
  await requireAdminPage("settings");
  const s = await getSettings();
  const f = (name: string, label: string, value: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field"><label htmlFor={name}>{label}</label><input id={name} name={name} className="input" defaultValue={value} {...props} /></div>
  );
  return (
    <div className="stack">
      <h1 style={{ fontSize: "2rem" }}>Site settings</h1>
      <ActionForm action={updateSettings} submitLabel="Save settings">
        <section className="panel stack">
          <h3>Customer support</h3>
          <div className="grid-3">
            {f("whatsappNumber", "WhatsApp number (international, digits only)", s.whatsappNumber, { placeholder: "447700900123" })}
            {f("supportPhone", "Phone number shown to customers", s.supportPhone, { placeholder: "+44 20 0000 0000" })}
            {f("supportEmail", "Support email", s.supportEmail, { type: "email" })}
          </div>
          <p className="muted small">When a customer taps “Talk to a person” in the chat, they get a button that opens WhatsApp to this number with their chat reference. You can also reply inside the website from Customer chats.</p>
        </section>
        <section className="panel stack">
          <h3>Homepage</h3>
          {f("announcement", "Announcement bar (leave empty to hide)", s.announcement)}
          <div className="grid-2">
            {f("heroEyebrow", "Hero small heading", s.heroEyebrow)}
            {f("heroTitle", "Hero title", s.heroTitle)}
          </div>
          {f("heroSubtitle", "Hero text", s.heroSubtitle)}
          <div className="grid-3">
            {f("heroImage", "Hero image (https://… or /hero-img.jpg from the public folder)", s.heroImage)}
            {f("heroCtaLabel", "Button label", s.heroCtaLabel)}
            {f("heroCtaHref", "Button link", s.heroCtaHref, { placeholder: "/shop/new-arrivals" })}
          </div>
        </section>
        <section className="panel stack">
          <h3>Delivery charges</h3>
          <div className="grid-3">
            {f("gbpStandard", "UK standard (£)", toInputValue(s.shipping.GBP.standard))}
            {f("gbpExpress", "UK express (£)", toInputValue(s.shipping.GBP.express))}
            {f("gbpFreeOver", "UK free standard over (£)", toInputValue(s.shipping.GBP.freeOver))}
            {f("usdStandard", "US standard ($)", toInputValue(s.shipping.USD.standard))}
            {f("usdExpress", "US express ($)", toInputValue(s.shipping.USD.express))}
            {f("usdFreeOver", "US free standard over ($)", toInputValue(s.shipping.USD.freeOver))}
          </div>
          <label className="checkbox"><input type="checkbox" name="usStoreEnabled" defaultChecked={s.usStoreEnabled} /> Sell to the United States (USD prices)</label>
        </section>
        <section className="panel stack">
          <h3>Company details (shown in the footer)</h3>
          <div className="grid-3">
            {f("companyNumber", "Company registration number", s.companyNumber)}
            {f("vatNumber", "VAT number", s.vatNumber)}
            {f("companyAddress", "Registered address", s.companyAddress)}
          </div>
        </section>
      </ActionForm>
    </div>
  );
}
