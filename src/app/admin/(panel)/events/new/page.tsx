import Link from "next/link";
import { EMPTY_EVENT, EventForm } from "@/components/admin/EventForm";
import { requireAdminPage } from "@/lib/auth";
import { EVENT_THEMES } from "@/lib/events";

export default async function NewEvent() {
  await requireAdminPage("settings");
  return (
    <div className="stack">
      <Link href="/admin/events" className="small muted">← All events</Link>
      <h1 style={{ fontSize: "2rem" }}>New event</h1>
      <EventForm initial={EMPTY_EVENT} themes={EVENT_THEMES} />
    </div>
  );
}
