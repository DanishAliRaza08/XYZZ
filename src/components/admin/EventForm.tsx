"use client";

import { useState } from "react";
import { saveEvent } from "@/app/admin/actions";
import { ActionForm } from "./ActionForm";

type Banner = { image: string; title: string; href: string };

export type EventInitial = {
  id?: string;
  name: string;
  theme: string;
  active: boolean;
  startsAt: string; // yyyy-mm-dd
  endsAt: string;
  barText: string;
  barLinkLabel: string;
  barLinkHref: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  collection: string;
  sectionTitle: string;
  accentColor: string;
  decorations: boolean;
  banners: Banner[];
};

export const EMPTY_EVENT: EventInitial = {
  name: "", theme: "HALLOWEEN", active: false, startsAt: "", endsAt: "",
  barText: "", barLinkLabel: "", barLinkHref: "",
  heroEyebrow: "", heroTitle: "", heroSubtitle: "", heroImage: "", heroCtaLabel: "", heroCtaHref: "",
  collection: "", sectionTitle: "", accentColor: "", decorations: true, banners: [],
};

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data.url as string;
}

export function EventForm({ initial, themes }: { initial: EventInitial; themes: { value: string; label: string }[] }) {
  const [heroImage, setHeroImage] = useState(initial.heroImage);
  const [banners, setBanners] = useState<Banner[]>(initial.banners);
  const [accent, setAccent] = useState(initial.accentColor);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const runUpload = async (files: FileList | null, onUrl: (url: string) => void) => {
    if (!files?.length) return;
    setBusy(true);
    setUploadError(null);
    try {
      for (const f of Array.from(files)) onUrl(await uploadImage(f));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    }
    setBusy(false);
  };
  const updateBanner = (i: number, patch: Partial<Banner>) => setBanners((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const f = (name: keyof EventInitial, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" defaultValue={String(initial[name] ?? "")} {...props} />
    </div>
  );

  return (
    <ActionForm action={saveEvent} submitLabel={initial.id ? "Save event" : "Create event"}>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="heroImage" value={heroImage} />
      <input type="hidden" name="banners" value={JSON.stringify(banners.filter((b) => b.image))} />
      <input type="hidden" name="accentColor" value={accent} />

      <section className="panel stack">
        <h3>Event</h3>
        <div className="grid-2">
          {f("name", "Event name *", { required: true, maxLength: 60, placeholder: "Halloween 2026" })}
          <div className="field">
            <label htmlFor="theme">Theme</label>
            <select id="theme" name="theme" className="select" defaultValue={initial.theme}>
              {themes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-3">
          {f("startsAt", "Starts on (optional)", { type: "date" })}
          {f("endsAt", "Ends on (optional)", { type: "date" })}
          <div className="field">
            <label htmlFor="accentPicker">Accent colour (optional)</label>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input id="accentPicker" type="color" value={accent || "#c84c06"} onChange={(e) => setAccent(e.target.value)} style={{ width: 44, height: 40, padding: 0, border: 0, background: "none" }} />
              <input className="input" value={accent} onChange={(e) => setAccent(e.target.value.trim())} placeholder="Theme default" aria-label="Accent colour hex" />
              {accent && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAccent("")}>Reset</button>}
            </div>
          </div>
        </div>
        <div className="row">
          <label className="checkbox"><input type="checkbox" name="active" defaultChecked={initial.active} /> Switched on</label>
          <label className="checkbox"><input type="checkbox" name="decorations" defaultChecked={initial.decorations} /> Falling bats / snow animation</label>
        </div>
        <p className="muted small">
          The event shows on the website while it is switched on <strong>and</strong> today is between the start and end dates (leave dates empty to run
          until you switch it off). If two events are live, the one that started most recently is shown.
        </p>
      </section>

      <section className="panel stack">
        <h3>Top bar</h3>
        {f("barText", "Bar text *", { required: true, maxLength: 200, placeholder: "🎃 Halloween costumes now in — next-day delivery available" })}
        <div className="grid-2">
          {f("barLinkLabel", "Link label", { maxLength: 40, placeholder: "Shop Halloween" })}
          {f("barLinkHref", "Link (page on this site)", { placeholder: "/search?q=Halloween" })}
        </div>
      </section>

      <section className="panel stack">
        <h3>Homepage banner</h3>
        <div className="grid-2">
          {f("heroEyebrow", "Small heading", { maxLength: 60, placeholder: "Spooky season" })}
          {f("heroTitle", "Title *", { required: true, maxLength: 120, placeholder: "Trick or treat in style" })}
        </div>
        {f("heroSubtitle", "Text", { maxLength: 300 })}
        <div className="grid-2">
          {f("heroCtaLabel", "Button label", { maxLength: 40, placeholder: "Shop the Halloween edit" })}
          {f("heroCtaHref", "Button link", { placeholder: "/search?q=Halloween" })}
        </div>
        <div className="field">
          <label>Banner picture (optional — without one, a themed illustration is shown)</label>
          {heroImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt="" style={{ width: "100%", maxWidth: 480, aspectRatio: "16/7", objectFit: "cover", borderRadius: 6, background: "var(--surface-2)" }} />
          )}
          <div className="row">
            <label className="btn btn-sm btn-outline" style={{ cursor: "pointer" }}>
              {busy ? "Uploading…" : heroImage ? "Replace picture" : "Upload picture"}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => runUpload(e.target.files, setHeroImage)} />
            </label>
            {heroImage && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setHeroImage("")}>Remove</button>}
            <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="…or paste https:// or /images/… path" value={heroImage} onChange={(e) => setHeroImage(e.target.value.trim())} aria-label="Banner picture URL" />
          </div>
        </div>
      </section>

      <section className="panel stack">
        <h3>Event shop section</h3>
        <div className="grid-2">
          {f("sectionTitle", "Section title", { maxLength: 80, placeholder: "The Halloween shop" })}
          {f("collection", "Show products whose Collection is", { maxLength: 80, placeholder: "Halloween" })}
        </div>
        <p className="muted small">Set a product&apos;s <em>Collection / edit</em> field (Admin → Products) to the same word to include it here.</p>

        <h4 style={{ margin: "8px 0 0" }}>Promo pictures</h4>
        <p className="muted small">Upload pictures (e.g. costumes, Christmas jumpers, gift ideas). Each can have a caption and link.</p>
        <div className="event-banners">
          {banners.map((b, i) => (
            <div key={b.image + i} className="stack" style={{ gap: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image} alt="" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", borderRadius: 6, background: "var(--surface-2)" }} />
              <input className="input" placeholder="Caption" value={b.title} maxLength={80} onChange={(e) => updateBanner(i, { title: e.target.value })} aria-label="Caption" />
              <input className="input" placeholder="Link, e.g. /shop/girls" value={b.href} onChange={(e) => updateBanner(i, { href: e.target.value.trim() })} aria-label="Link" />
              <div className="row" style={{ gap: 2 }}>
                <button type="button" className="btn btn-sm btn-ghost" disabled={i === 0} onClick={() => setBanners((bs) => { const n = [...bs]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} aria-label="Move earlier">←</button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setBanners((bs) => bs.filter((_, j) => j !== i))}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        <div className="row">
          <label className="btn btn-sm btn-outline" style={{ cursor: "pointer" }}>
            {busy ? "Uploading…" : "Add promo pictures"}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => runUpload(e.target.files, (url) => setBanners((bs) => [...bs, { image: url, title: "", href: "" }]))} />
          </label>
        </div>
        {uploadError && <p className="field-error">{uploadError}</p>}
      </section>
    </ActionForm>
  );
}
