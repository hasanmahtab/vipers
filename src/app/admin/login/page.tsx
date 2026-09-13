import { loginAction } from "@/lib/actions";
import { Card } from "@/components/ui";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const next = searchParams.next || "/admin";

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <h1 className="mb-1 font-display text-2xl font-bold text-neon">Admin Login</h1>
        <p className="mb-4 text-sm text-white/60">Only for entering match scores &amp; managing the league.</p>

        {searchParams.error && (
          <p className="mb-3 rounded-md border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-blood">
            Invalid username or password.
          </p>
        )}

        <form action={loginAction} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-white/50">Username</label>
            <input
              name="username"
              required
              autoComplete="username"
              className="w-full rounded-md border border-ink-border bg-ink-soft px-3 py-2 text-sm outline-none focus:border-neon"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-white/50">Password</label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-ink-border bg-ink-soft px-3 py-2 text-sm outline-none focus:border-neon"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-neon py-2 font-display font-bold uppercase tracking-wide text-ink transition hover:bg-neon-glow"
          >
            Log In
          </button>
        </form>
      </Card>
    </div>
  );
}
