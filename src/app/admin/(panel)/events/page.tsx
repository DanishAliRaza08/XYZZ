import Link from "next/link";
import { toggleEvent } from "../../actions";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EVENT_THEMES, getActiveEvent, isLive } from "@/lib/events";

const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

export default async function EventsAdmin() {
  await requireAdminPage("settings");
  const [events, showing] = await Promise.all([
    prisma.seasonalEvent.findMany({ orderBy: [{ startsAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }] }),
    getActiveEvent(),
  ]);
  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ fontSize: "2rem", margin: 0 }}>Seasonal events</h1>
        <span className="spacer" />
        <Link href="/admin/events/new" className="btn btn-sm">+ New event</Link>
      </div>
      <p className="muted">
        Halloween, Christmas, Black Friday… While an event is live, every page shows its bar at the top, the site switches to the event&apos;s colours and the
        homepage uses the event&apos;s banner, pictures and products.
      </p>
      <div className={`alert ${showing ? "alert-success" : ""}`}>
        {showing ? <>Showing now: <strong>{showing.name}</strong></> : "No event is live — the website is using its normal look."}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Event</th><th>Theme</th><th>Dates</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {events.length === 0 && <tr><td colSpan={5} className="muted center">No events yet.</td></tr>}
            {events.map((e) => {
              const live = isLive(e);
              const label = live ? (showing?.id === e.id ? "live" : "live (hidden by newer event)") : e.active ? "scheduled / ended" : "off";
              return (
                <tr key={e.id}>
                  <td><Link href={`/admin/events/${e.id}`}><strong>{e.name}</strong></Link><div className="muted small">{e.barText}</div></td>
                  <td>{EVENT_THEMES.find((t) => t.value === e.theme)?.label.split(" (")[0]}</td>
                  <td className="small">{fmt(e.startsAt)} → {fmt(e.endsAt)}</td>
                  <td><span className={`status status-${live ? "PUBLISHED" : e.active ? "PROCESSING" : "DRAFT"}`}>{label}</span></td>
                  <td>
                    <form action={toggleEvent}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className={`btn btn-sm ${e.active ? "btn-ghost" : "btn-outline"}`}>{e.active ? "Switch off" : "Switch on"}</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
