// A short confetti / firework burst for happy moments (added to bag, order paid). Plain DOM, no library:
// the pieces are absolutely positioned spans animated by CSS (globals.css → .confetti-piece) and removed after.
// Does nothing for visitors who ask their device to reduce motion.

const COLOURS = ["#e63946", "#f4a261", "#ffd166", "#06d6a0", "#118ab2", "#9b5de5", "#ff70a6", "#c9a85b"];

function reducedMotion() {
  return typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function layer() {
  const el = document.createElement("div");
  el.className = "confetti-layer";
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
  return el;
}

/** Confetti shooting up from a point (e.g. the button that was pressed), then falling. */
export function confettiFrom(x: number, y: number, count = 70) {
  if (reducedMotion()) return;
  const el = layer();
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = `confetti-piece${i % 3 === 0 ? " round" : ""}`;
    const angle = (-90 + (Math.random() - 0.5) * 140) * (Math.PI / 180); // mostly upwards
    const dist = 120 + Math.random() * 260;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = COLOURS[i % COLOURS.length];
    p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
    p.style.setProperty("--fall", `${180 + Math.random() * 220}px`);
    p.style.setProperty("--spin", `${(Math.random() - 0.5) * 1080}deg`);
    p.style.animationDelay = `${Math.random() * 80}ms`;
    p.style.animationDuration = `${1300 + Math.random() * 700}ms`;
    el.appendChild(p);
  }
}

/** Confetti from an element's centre. */
export function confettiFromElement(target: Element | null) {
  if (!target) return confettiFrom(window.innerWidth / 2, window.innerHeight / 2);
  const r = target.getBoundingClientRect();
  confettiFrom(r.left + r.width / 2, r.top + r.height / 2);
}

/** A few firework bursts across the top of the screen (thank-you page). */
export function fireworks(bursts = 4) {
  if (reducedMotion()) return;
  const el = layer();
  for (let b = 0; b < bursts; b++) {
    const cx = window.innerWidth * (0.15 + Math.random() * 0.7);
    const cy = window.innerHeight * (0.15 + Math.random() * 0.3);
    const colour = COLOURS[(b * 3) % COLOURS.length];
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("span");
      p.className = "firework-spark";
      const angle = (i / 28) * Math.PI * 2;
      const dist = 70 + Math.random() * 50;
      p.style.left = `${cx}px`;
      p.style.top = `${cy}px`;
      p.style.background = colour;
      p.style.boxShadow = `0 0 6px ${colour}`;
      p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      p.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      p.style.animationDelay = `${b * 350}ms`;
      el.appendChild(p);
    }
  }
  setTimeout(() => confettiFrom(window.innerWidth / 2, window.innerHeight * 0.35, 90), 200);
}
