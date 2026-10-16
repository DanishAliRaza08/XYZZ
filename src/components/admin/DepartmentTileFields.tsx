"use client";

import { useState } from "react";

export type TileField = { slug: string; title: string; defaultImage: string; defaultText: string; defaultButton: string; image: string; text: string; button: string };

/** One row per homepage "Shop by department" tile in Admin → Site settings. Empty fields use the defaults. */
export function DepartmentTileFields({ tiles }: { tiles: TileField[] }) {
  return (
    <div className="stack">
      {tiles.map((t) => (
        <TileRow key={t.slug} tile={t} />
      ))}
    </div>
  );
}

function TileRow({ tile }: { tile: TileField }) {
  const [image, setImage] = useState(tile.image);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setImage(data.url);
    else setError(data.error ?? "Upload failed");
    setBusy(false);
  };

  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image || tile.defaultImage} alt="" style={{ width: 120, aspectRatio: "4/3", objectFit: "cover", borderRadius: 6, background: "var(--surface-2)" }} />
      <div className="stack" style={{ flex: 1, minWidth: 240, gap: 8 }}>
        <strong>{tile.title}</strong>
        <input type="hidden" name={`tile_${tile.slug}_image`} value={image} />
        <div className="row">
          <label className="btn btn-sm btn-outline" style={{ cursor: "pointer" }}>
            {busy ? "Uploading…" : image ? "Replace picture" : "Upload picture"}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files)} />
          </label>
          {image && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setImage("")}>Use default picture</button>}
          {error && <span className="field-error">{error}</span>}
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor={`tile_${tile.slug}_text`}>Text</label>
            <input id={`tile_${tile.slug}_text`} name={`tile_${tile.slug}_text`} className="input" defaultValue={tile.text} placeholder={tile.defaultText} maxLength={160} />
          </div>
          <div className="field">
            <label htmlFor={`tile_${tile.slug}_button`}>Button label</label>
            <input id={`tile_${tile.slug}_button`} name={`tile_${tile.slug}_button`} className="input" defaultValue={tile.button} placeholder={tile.defaultButton} maxLength={40} />
          </div>
        </div>
      </div>
    </div>
  );
}
