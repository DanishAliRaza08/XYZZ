import { createStaff, toggleStaff } from "../../actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function StaffAdmin() {
  const me = await requireAdminPage("staff");
  const [staff, logs] = await Promise.all([
    prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({ include: { admin: true }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  return (
    <div className="stack">
      <h1 style={{ fontSize: "2rem" }}>Staff & permissions</h1>
      <section className="panel">
        <h3>Add staff member</h3>
        <ActionForm action={createStaff} submitLabel="Create account" resetOnSuccess>
          <div className="grid-2">
            <div className="field"><label htmlFor="sname">Name</label><input id="sname" name="name" className="input" /></div>
            <div className="field"><label htmlFor="semail">Email</label><input id="semail" name="email" type="email" className="input" required /></div>
            <div className="field"><label htmlFor="spass">Temporary password (10+ characters)</label><input id="spass" name="password" type="password" className="input" required minLength={10} autoComplete="new-password" /></div>
            <div className="field">
              <label htmlFor="srole">Role</label>
              <select id="srole" name="role" className="select" defaultValue="CUSTOMER_SERVICE">
                <option value="SUPER_ADMIN">Super admin — everything</option>
                <option value="PRODUCT_MANAGER">Product manager — products, pricing, discounts</option>
                <option value="ORDER_MANAGER">Order manager — orders</option>
                <option value="CUSTOMER_SERVICE">Customer service — chats & orders</option>
                <option value="CONTENT_EDITOR">Content editor — site settings</option>
                <option value="ANALYST">Analyst — dashboard only</option>
              </select>
            </div>
          </div>
        </ActionForm>
      </section>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign in</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td><td>{u.role.replace(/_/g, " ").toLowerCase()}</td>
                <td>{u.lastLoginAt?.toLocaleString("en-GB") ?? "never"}</td>
                <td><span className={`status ${u.active ? "status-PAID" : "status-NEEDS_ATTENTION"}`}>{u.active ? "active" : "disabled"}</span></td>
                <td>{u.id !== me.id && <form action={toggleStaff}><input type="hidden" name="id" value={u.id} /><button className="btn btn-sm btn-ghost">{u.active ? "Disable" : "Enable"}</button></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="panel">
        <h3>Recent activity (audit log)</h3>
        {logs.map((l) => (
          <div key={l.id} className="small"><span className="muted">{l.createdAt.toLocaleString("en-GB")}</span> — {l.admin?.name ?? "system"} · {l.action} {l.entity} {l.details ?? ""}</div>
        ))}
      </section>
    </div>
  );
}
