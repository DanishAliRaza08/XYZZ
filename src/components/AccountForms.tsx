"use client";

import { registerCustomer, signInCustomer } from "@/app/(store)/account/actions";
import { useKeepValuesAction } from "./admin/ActionForm";

export function SignInForm({ next }: { next: string }) {
  const { state, pending, onSubmit } = useKeepValuesAction(signInCustomer);
  return (
    <form onSubmit={onSubmit} className="stack">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      <button className="btn btn-block" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const { state, pending, onSubmit } = useKeepValuesAction(registerCustomer);
  return (
    <form onSubmit={onSubmit} className="stack">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="name">Full name</label>
        <input id="name" name="name" className="input" autoComplete="name" required maxLength={120} />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="email" required maxLength={160} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" required minLength={8} />
        <span className="muted small">At least 8 characters.</span>
      </div>
      {state?.error && <p className="alert alert-error" role="alert">{state.error}</p>}
      <button className="btn btn-block" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
    </form>
  );
}
