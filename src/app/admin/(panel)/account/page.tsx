import { changePassword } from "../../actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdminPage } from "@/lib/auth";

export default async function AccountPage() {
  const admin = await requireAdminPage("dashboard");
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: "2rem" }}>My account</h1>
      <p className="muted">{admin.name} · {admin.email}</p>
      <section className="panel">
        <h3>Change password</h3>
        <ActionForm action={changePassword} submitLabel="Change password" resetOnSuccess>
          <div className="field"><label htmlFor="current">Current password</label><input id="current" name="current" type="password" className="input" required autoComplete="current-password" /></div>
          <div className="field"><label htmlFor="next">New password (10+ characters)</label><input id="next" name="next" type="password" className="input" required minLength={10} autoComplete="new-password" /></div>
        </ActionForm>
      </section>
    </div>
  );
}
