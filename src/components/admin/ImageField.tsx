"use client";

// Picture upload + "Adjust" (choose which part of the picture shows in its frame) + recommended size, for every
// picture uploaded in the admin. The framing is saved on the picture address (src/lib/image-focus.ts) and used by
// ShopImage everywhere the picture appears in the shop.
import { useEffect, useRef, useState } from "react";
import { IMAGE_SIZES, focusStyle, parseImage, withFocus, type ImageKind } from "@/lib/image-focus";

export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data.url as string;
}

/** The frames a kind of picture is shown in (the hero is wide on computers and tall on phones). */
const FRAMES: Record<ImageKind, { label: string; aspect: number }[]> = {
  hero: [{ label: "Computer", aspect: 2.4 }, { label: "Phone", aspect: 0.75 }],
  tile: [{ label: "Tile", aspect: 4 / 3 }],
  product: [{ label: "Product photo", aspect: 3 / 4 }],
  blogCover: [{ label: "Post page", aspect: 16 / 9 }, { label: "Blog list", aspect: 3 / 2 }],
  blogPhoto: [{ label: "Photo", aspect: 4 / 3 }],
};

/** "Recommended: 1920 × 800 px …" plus the uploaded picture's real size and a warning when it doesn't fit well. */
export function SizeHint({ kind, value }: { kind: ImageKind; value?: string }) {
  const rec = IMAGE_SIZES[kind];
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const src = value ? parseImage(value).src : "";
  useEffect(() => {
    setSize(null);
    if (!src) return;
    const img = new window.Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);
  const recText = rec.h ? `${rec.w} × ${rec.h} px` : `at least ${rec.w} px wide`;
  let warning = "";
  if (size) {
    if (size.w < rec.w * 0.6) warning = "This picture is small and may look blurry — upload a bigger one if you can.";
    else if (rec.h && Math.abs(size.w / size.h / (rec.w / rec.h) - 1) > 0.25) warning = "This picture is a different shape, so some of it is cut off — use Adjust to choose which part shows.";
  }
  return (
    <p className="muted small" style={{ margin: 0 }}>
      📐 Recommended size: <strong>{recText}</strong> ({rec.note}). JPG, PNG or WebP, up to 5MB.
      {size && <> Your picture: {size.w} × {size.h} px.</>}
      {warning && <span style={{ display: "block", color: "var(--danger)" }}>{warning}</span>}
    </p>
  );
}

/** The Adjust window: drag the picture to choose what stays in view, zoom with the slider. */
export function ImageAdjuster({ value, kind, onSave, onClose }: { value: string; kind: ImageKind; onSave: (value: string) => void; onClose: () => void }) {
  const start = parseImage(value);
  const [f, setF] = useState(start);
  const drag = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number } | null>(null);
  const frames = FRAMES[kind];
  const clamp = (n: number) => Math.min(100, Math.max(0, n));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const frame = (label: string, aspect: number, main: boolean) => (
    <div key={label} className="stack" style={{ gap: 4, flex: main ? "1 1 420px" : "0 0 150px", minWidth: 0 }}>
      <span className="small muted">{label}</span>
      <div
        // The frame keeps its shape but never gets taller than about half the screen, so tall photos fit in the window.
        style={{ position: "relative", width: `min(100%, ${(main ? 55 : 30) * aspect}vh)`, aspectRatio: String(aspect), overflow: "hidden", borderRadius: 6, background: "var(--surface-2)", cursor: main ? "grab" : "default", touchAction: "none", outline: "1px solid var(--border)" }}
        onPointerDown={(e) => {
          if (!main) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const r = e.currentTarget.getBoundingClientRect();
          drag.current = { px: e.clientX, py: e.clientY, x: f.x, y: f.y, w: r.width, h: r.height };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          // Dragging the picture right shows more of its left side, so the focus point moves the opposite way.
          setF((cur) => ({ ...cur, x: clamp(d.x - ((e.clientX - d.px) / d.w) * 100), y: clamp(d.y - ((e.clientY - d.py) / d.h) * 100) }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.src} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", userSelect: "none", pointerEvents: "none", ...focusStyle(f) }} />
      </div>
    </div>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Adjust picture" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="panel stack" onClick={(e) => e.stopPropagation()} style={{ width: "min(900px, 100%)", maxHeight: "95vh", overflow: "auto" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Adjust picture</h3>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>Drag the picture to choose which part shows in the frame, and zoom in if needed. This is exactly how it&apos;s cropped in the shop.</p>
        <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>{frames.map((fr, i) => frame(fr.label, fr.aspect, i === 0))}</div>
        <label className="row small" style={{ gap: 10 }}>
          Zoom
          <input type="range" min={1} max={3} step={0.05} value={f.zoom} onChange={(e) => setF({ ...f, zoom: Number(e.target.value) })} style={{ flex: 1, maxWidth: 360 }} aria-label="Zoom" />
          <span style={{ width: 42 }}>{Math.round(f.zoom * 100)}%</span>
        </label>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn btn-sm" onClick={() => { onSave(withFocus(f)); onClose(); }}>Save position</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setF({ ...f, x: 50, y: 50, zoom: 1 })}>Reset to centre</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/** "Adjust" button that opens the Adjust window for a picture you already have in a list (e.g. product photos). */
export function AdjustButton({ value, kind, onChange, className = "btn btn-sm btn-ghost" }: { value: string; kind: ImageKind; onChange: (value: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} disabled={!value}>Adjust</button>
      {open && <ImageAdjuster value={value} kind={kind} onSave={onChange} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * A complete picture field for admin forms: preview, Upload/Replace, Adjust, Remove, the recommended size,
 * and a hidden input named `name` holding the picture address (with its framing).
 */
export function ImageField({
  name,
  initial,
  kind,
  label,
  defaultImage,
  onChange,
}: {
  name?: string;
  initial: string;
  kind: ImageKind;
  label?: string;
  defaultImage?: string; // shown (and adjustable later) when nothing is uploaded, e.g. a department tile's default photo
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aspect = FRAMES[kind][0].aspect;
  const set = (v: string) => {
    setValue(v);
    onChange?.(v);
  };
  const shown = value || defaultImage || "";
  const f = parseImage(shown);

  return (
    <div className="stack" style={{ gap: 8 }}>
      {label && <strong className="small">{label}</strong>}
      {name && <input type="hidden" name={name} value={value} />}
      <div style={{ position: "relative", width: "100%", maxWidth: kind === "hero" ? 520 : 260, aspectRatio: String(aspect), overflow: "hidden", borderRadius: 6, background: "var(--surface-2)" }}>
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...focusStyle(f) }} />
        ) : (
          <span className="muted small" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>No picture</span>
        )}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <label className="btn btn-sm btn-outline" style={{ cursor: "pointer" }}>
          {busy ? "Uploading…" : value ? "Replace picture" : "Upload picture"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setError(null);
              try {
                set(await uploadImage(file));
              } catch (err) {
                setError(err instanceof Error ? err.message : "Upload failed");
              }
              setBusy(false);
            }}
          />
        </label>
        {shown && <AdjustButton value={shown} kind={kind} onChange={set} />}
        {value && <button type="button" className="btn btn-sm btn-ghost" onClick={() => set("")}>{defaultImage ? "Use default picture" : "Remove"}</button>}
      </div>
      <SizeHint kind={kind} value={value} />
      {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
