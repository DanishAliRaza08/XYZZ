"use client";

import { startTransition, useActionState, useState } from "react";
import type { FormState } from "@/app/admin/actions";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

/**
 * Submits via onSubmit (not the `action` prop) so React doesn't reset the form after every
 * submission — a validation error must not wipe what the user typed.
 */
export function useKeepValuesAction(action: Action) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(fd));
  };
  return { state, pending, onSubmit };
}

export function ActionForm({
  action,
  children,
  className,
  submitLabel = "Save",
  resetOnSuccess,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
  resetOnSuccess?: boolean;
}) {
  const { state, pending, onSubmit } = useKeepValuesAction(action);
  const [resetKey, setResetKey] = useState(0);
  const [lastOk, setLastOk] = useState<FormState>(undefined);
  if (resetOnSuccess && state?.ok && state !== lastOk) {
    setLastOk(state);
    setResetKey((k) => k + 1);
  }
  return (
    <form onSubmit={onSubmit} className={className ?? "admin-form"} key={resetKey}>
      {children}
      <div className="row">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
        {state?.error && <span className="field-error" role="alert">{state.error}</span>}
        {state?.ok && <span role="status" style={{ color: "var(--success)" }}>{state.ok}</span>}
      </div>
    </form>
  );
}

export function ConfirmButton({ label, message, className = "btn btn-sm btn-outline" }: { label: string; message: string; className?: string }) {
  return (
    <button className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {label}
    </button>
  );
}
