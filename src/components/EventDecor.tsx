import type { EventTheme } from "@prisma/client";

const SYMBOLS: Partial<Record<EventTheme, string[]>> = {
  HALLOWEEN: ["🦇", "🦇", "🎃", "🕸️"],
  CHRISTMAS: ["❄", "❅", "❆", "❄"],
};

/** A light, decorative layer of falling bats or snowflakes. Hidden for visitors who prefer reduced motion. */
export function EventDecor({ theme }: { theme: EventTheme }) {
  const symbols = SYMBOLS[theme];
  if (!symbols) return null;
  // Deterministic positions so server and client render the same markup.
  const flakes = Array.from({ length: 14 }, (_, i) => ({
    symbol: symbols[i % symbols.length],
    left: (i * 37 + 11) % 100,
    size: 14 + ((i * 7) % 16),
    duration: 11 + ((i * 5) % 9),
    delay: -((i * 3.3) % 14),
  }));
  return (
    <div className="event-decor" aria-hidden>
      {flakes.map((f, i) => (
        <span
          key={i}
          style={{
            left: `${f.left}%`,
            fontSize: f.size,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            color: theme === "CHRISTMAS" ? "#ffffff" : undefined,
            textShadow: theme === "CHRISTMAS" ? "0 0 4px rgba(80,110,140,0.6)" : undefined,
          }}
        >
          {f.symbol}
        </span>
      ))}
    </div>
  );
}
