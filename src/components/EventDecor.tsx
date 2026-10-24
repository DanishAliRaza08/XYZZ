"use client";

import type { EventTheme } from "@prisma/client";
import { useEffect, useState } from "react";

const SYMBOLS: Partial<Record<EventTheme, string[]>> = {
  HALLOWEEN: ["🦇", "🦇", "🎃", "🕸️"],
  CHRISTMAS: ["❄", "❅", "❆", "❄"],
};

/**
 * A light, decorative layer of falling bats or snowflakes. Hidden for visitors who prefer reduced motion.
 * 32 are rendered; CSS shows 14 on phones and laptops, and more on wide screens so they don't look sparse.
 * They fall for `seconds` (set per event in Admin → Seasonal events; 0 = keep falling) and then fade away.
 * The time counts across pages for the whole visit, so opening another page doesn't start them again.
 */
export function EventDecor({ theme, seconds, visitKey }: { theme: EventTheme; seconds: number; visitKey: string }) {
  const [state, setState] = useState<"waiting" | "falling" | "ending" | "done">("waiting");

  useEffect(() => {
    if (seconds <= 0) return setState("falling");
    const key = `fr-decor:${visitKey}`;
    let started = Date.now();
    try {
      const saved = Number(sessionStorage.getItem(key));
      if (saved > 0 && saved <= started) started = saved;
      else sessionStorage.setItem(key, String(started));
    } catch {
      // Private mode / storage blocked: just count from this page.
    }
    const left = seconds * 1000 - (Date.now() - started);
    if (left <= 0) return setState("done");
    setState("falling");
    const end = setTimeout(() => setState("ending"), left);
    const gone = setTimeout(() => setState("done"), left + 1500);
    return () => {
      clearTimeout(end);
      clearTimeout(gone);
    };
  }, [seconds, visitKey]);

  const symbols = SYMBOLS[theme];
  // Not drawn on the server: whether they still fall depends on this visitor's time on the site.
  if (!symbols || state === "waiting" || state === "done") return null;
  // Deterministic positions.
  const flakes = Array.from({ length: 32 }, (_, i) => ({
    symbol: symbols[i % symbols.length],
    left: (i * 37 + 11) % 100,
    size: 14 + ((i * 7) % 16),
    duration: 11 + ((i * 5) % 9),
    delay: -((i * 3.3) % 14),
  }));
  return (
    <div className={`event-decor${state === "ending" ? " event-decor-ending" : ""}`} aria-hidden>
      {flakes.map((f, i) => (
        <span
          key={i}
          style={{
            left: `${f.left}%`,
            fontSize: f.size,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
          }}
        >
          {f.symbol}
        </span>
      ))}
    </div>
  );
}
