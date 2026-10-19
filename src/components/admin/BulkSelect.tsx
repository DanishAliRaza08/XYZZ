"use client";

import { useEffect, useRef, useState } from "react";

// Ticking products for bulk actions (Admin → Products). The row checkboxes belong to the bulk form
// through form="<formId>", so each row can keep its own Publish/Unpublish form.
const boxes = (formId: string) => [...document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name=ids][form="${formId}"]`)];

/** "Select all" checkbox for the table header, kept in sync with the row checkboxes (ticked, unticked or partly). */
export function SelectAll({ formId }: { formId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const sync = () => {
      const all = boxes(formId);
      const ticked = all.filter((b) => b.checked).length;
      if (!ref.current) return;
      ref.current.checked = all.length > 0 && ticked === all.length;
      ref.current.indeterminate = ticked > 0 && ticked < all.length;
    };
    document.addEventListener("change", sync);
    sync();
    return () => document.removeEventListener("change", sync);
  }, [formId]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Select all products on this page"
      onChange={(e) => {
        for (const b of boxes(formId)) b.checked = e.target.checked;
        document.dispatchEvent(new Event("change"));
      }}
    />
  );
}

/** "3 selected" plus the bulk buttons; buttons stay disabled until something is ticked. Delete asks first. */
export function BulkBar({ formId, total }: { formId: string; total: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const sync = () => setCount(boxes(formId).filter((b) => b.checked).length);
    document.addEventListener("change", sync);
    sync();
    return () => document.removeEventListener("change", sync);
  }, [formId]);
  const none = count === 0;
  return (
    <div className="row bulk-bar" style={{ gap: 6 }}>
      <strong className="small" style={{ minWidth: 90 }}>{none ? `${total} products` : `${count} selected`}</strong>
      <button className="btn btn-sm btn-outline" name="bulk" value="PUBLISHED" form={formId} disabled={none}>Publish</button>
      <button className="btn btn-sm btn-outline" name="bulk" value="DRAFT" form={formId} disabled={none}>Move to draft</button>
      <button className="btn btn-sm btn-outline" name="bulk" value="ARCHIVED" form={formId} disabled={none}>Archive</button>
      <button
        className="btn btn-sm btn-ghost"
        name="bulk"
        value="delete"
        form={formId}
        disabled={none}
        style={{ color: none ? undefined : "var(--danger)" }}
        onClick={(e) => {
          if (!confirm(`Delete ${count} product${count === 1 ? "" : "s"}? This can't be undone. Products with past orders are archived instead.`)) e.preventDefault();
        }}
      >
        Delete
      </button>
    </div>
  );
}
