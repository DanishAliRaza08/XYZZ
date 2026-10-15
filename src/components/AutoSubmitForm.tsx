"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

/** A GET form that navigates as soon as a filter changes (and still works without JavaScript via the Apply button). */
export function AutoSubmitForm({ action, children, className }: { action: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const go = () => {
    const form = ref.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) if (typeof v === "string" && v !== "") params.append(k, v);
    params.delete("page");
    router.push(`${action}${params.size ? `?${params}` : ""}`, { scroll: false });
  };
  return (
    <form
      ref={ref}
      action={action}
      method="get"
      className={className}
      onChange={(e) => {
        // Price inputs wait for the Apply button so typing "25" doesn't navigate on "2".
        const target = e.target as unknown as HTMLInputElement;
        if (target.type !== "number") go();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      {children}
    </form>
  );
}
