import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteEvent } from "../../../actions";
import { ConfirmButton } from "@/components/admin/ActionForm";
import { EventForm } from "@/components/admin/EventForm";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVENT_THEMES, isLive, parseBanners } from "@/lib/events";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdminPage("settings");
  const { id } = await params;
  const e = await prisma.seasonalEvent.findUnique({ where: { id } });
  if (!e) notFound();
  const saved = (await searchParams).saved;
  return (
    <div className="stack">
      <Link href="/admin/events" className="small muted">← All events</Link>
      <div className="row">
        <h1 style={{ fontSize: "2rem", margin: 0 }}>{e.name}</h1>
        {isLive(e) && <span className="status status-PUBLISHED">live</span>}
        <span className="spacer" />
        <Link href="/" target="_blank" className="btn btn-sm btn-outline">View shop</Link>
        <form action={deleteEvent}>
          <input type="hidden" name="id" value={e.id} />
          <ConfirmButton label="Delete" message="Delete this event? This can't be undone." className="btn btn-sm btn-danger" />
        </form>
      </div>
      {saved && <div className="alert alert-success">Event created.</div>}
      <EventForm
        themes={EVENT_THEMES}
        initial={{
          id: e.id,
          name: e.name,
          theme: e.theme,
          active: e.active,
          startsAt: day(e.startsAt),
          endsAt: day(e.endsAt),
          barText: e.barText,
          barLinkLabel: e.barLinkLabel ?? "",
          barLinkHref: e.barLinkHref ?? "",
          heroEyebrow: e.heroEyebrow ?? "",
          heroTitle: e.heroTitle,
          heroSubtitle: e.heroSubtitle ?? "",
          heroImage: e.heroImage ?? "",
          heroTextPosition: e.heroTextPosition,
          heroCtaLabel: e.heroCtaLabel ?? "",
          heroCtaHref: e.heroCtaHref ?? "",
          collection: e.collection ?? "",
          sectionTitle: e.sectionTitle ?? "",
          accentColor: e.accentColor ?? "",
          decorations: e.decorations,
          decorSeconds: e.decorSeconds,
          banners: parseBanners(e.banners),
        }}
      />
    </div>
  );
}
