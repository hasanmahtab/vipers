import { addAdminUserAction, deleteAdminUserAction } from "@/lib/actions";
import { getAdminUsers } from "@/lib/queries";
import { getCurrentAdmin } from "@/lib/auth";
import { Card, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = getAdminUsers();
  const current = await getCurrentAdmin();

  return (
    <div className="space-y-6">
      <SectionTitle accent>Admin Login Accounts</SectionTitle>
      <p className="-mt-3 text-sm text-white/50">
        Anyone with an account here can log in and enter match scores. Create one per captain if you want
        to share scoring duties.
      </p>

      <Card>
        <h3 className="mb-3 font-display font-bold">Add Account</h3>
        <form action={addAdminUserAction} className="grid gap-3 sm:grid-cols-4">
          <input
            name="username"
            required
            placeholder="Username"
            className="rounded-md border border-ink-border bg-ink-soft px-2 py-2 text-sm"
          />
          <input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder="Password (6+ chars)"
            className="rounded-md border border-ink-border bg-ink-soft px-2 py-2 text-sm"
          />
          <input
            name="displayName"
            placeholder="Display name (optional)"
            className="rounded-md border border-ink-border bg-ink-soft px-2 py-2 text-sm"
          />
          <button className="rounded-md bg-neon px-4 py-2 font-display font-bold uppercase tracking-wide text-ink hover:bg-neon-glow">
            Add
          </button>
        </form>
      </Card>

      <Card className="divide-y divide-ink-border">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0 text-sm">
            <div>
              <span className="font-semibold">{u.username}</span>
              {u.display_name && <span className="ml-2 text-white/50">({u.display_name})</span>}
            </div>
            {current?.uid !== u.id && (
              <form action={deleteAdminUserAction}>
                <input type="hidden" name="id" value={u.id} />
                <button className="text-xs text-blood underline">Remove</button>
              </form>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
