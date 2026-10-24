"use client";

import { ImageField } from "./ImageField";

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
  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 240 }}>
        <ImageField name={`tile_${tile.slug}_image`} initial={tile.image} kind="tile" defaultImage={tile.defaultImage} label={tile.title} />
      </div>
      <div className="grid-2" style={{ flex: 1, minWidth: 240, alignSelf: "center" }}>
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
  );
}
