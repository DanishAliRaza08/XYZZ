import { updateSettings } from "../../actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { DepartmentTileFields } from "@/components/admin/DepartmentTileFields";
import { ImageField } from "@/components/admin/ImageField";
import { HERO_TEXT_POSITIONS } from "@/lib/hero";
import { requireAdminPage } from "@/lib/auth";
import { toInputValue } from "@/lib/money";
import { homeTiles } from "@/lib/navigation";
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
          <div className="grid-2">
            {f("heroCtaLabel", "Button label", s.heroCtaLabel)}
            {f("heroCtaHref", "Button link", s.heroCtaHref, { placeholder: "/shop/new-arrivals" })}
          </div>
          <ImageField name="heroImage" initial={s.heroImage} kind="hero" label="Banner picture (optional — without one, a simple illustration is shown)" />
          <div className="field" style={{ maxWidth: 420 }}>
            <label htmlFor="heroTextPosition">Text on the picture</label>
            <select id="heroTextPosition" name="heroTextPosition" className="select" defaultValue={s.heroTextPosition}>
              {HERO_TEXT_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <span className="muted small">If your picture already has writing on it, choose “Picture only” so the texts don&apos;t overlap. The whole banner then links to the button link.</span>
          </div>
          <p className="muted small">While a seasonal event is live, its own banner (Admin → Seasonal events) is shown instead of this one.</p>
        </section>
        <section className="panel stack">
          <h3>Shop by department tiles</h3>
          <p className="muted small">
            The picture cards on the homepage. Upload your own photo and use Adjust to choose which part shows, and change the text or
            button. Leave a field empty to use the default. To add or remove tiles, see README → “Menu, categories and pages”.
          </p>
          <DepartmentTileFields
            tiles={homeTiles().map((t) => ({
              slug: t.slug,
              title: t.title,
              defaultImage: t.image,
              defaultText: t.text,
              defaultButton: t.button,
              image: s.departmentTiles[t.slug]?.image ?? "",
              text: s.departmentTiles[t.slug]?.text ?? "",
              button: s.departmentTiles[t.slug]?.button ?? "",
            }))}
          />
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
