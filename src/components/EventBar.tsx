"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Event bar at the top of every store page. Closing it hides it for the rest of the browser session. */
export function EventBar({ storageKey, text, linkLabel, linkHref }: { storageKey: string; text: string; linkLabel?: string | null; linkHref?: string | null }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey) === "1") setHidden(true);
    } catch {
      // storage unavailable (private mode) — keep the bar visible
    }
  }, [storageKey]);
  const close = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
  };
  return (
    <div className="event-bar" role="region" aria-label="Seasonal offer" hidden={hidden}>
      <span>{text}</span>
      {linkHref && <Link href={linkHref}>{linkLabel || "Shop now"}</Link>}
      <button type="button" className="event-bar-close" onClick={close} aria-label="Close">×</button>
    </div>
  );
}
