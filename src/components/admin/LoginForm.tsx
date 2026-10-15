"use client";

import { login } from "@/app/admin/actions";
import { useKeepValuesAction } from "./ActionForm";

export function LoginForm() {
  const { state, pending, onSubmit } = useKeepValuesAction(login);
  return (
    <form onSubmit={onSubmit} className="stack">
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="username" required />
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
