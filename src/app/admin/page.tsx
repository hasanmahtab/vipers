import Link from "next/link";
import {
  createFixtureAction,
  createGameweekAction,
  deleteFixtureAction,
  logoutAction,
  markFixtureNotPlayedAction,
  setActiveGameweekAction,
} from "@/lib/actions";
import { getAllTeams, getFixturesByGameweek, getGameweeks } from "@/lib/queries";
import { Card, SectionTitle, TeamBadge } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { getCurrentAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const admin = await getCurrentAdmin();
  const gameweeks = await getGameweeks();
  const teams = await getAllTeams();
  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const fixturesByGw = Object.fromEntries(
    await Promise.all(gameweeks.map(async (gw) => [gw.id, await getFixturesByGameweek(gw.id)] as const))
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-neon">Admin Dashboard</h1>
          <p className="text-sm text-white/50">Logged in as {admin?.username}</p>
        </div>
        <form action={logoutAction}>
          <button className="rounded-md border border-ink-border px-3 py-1.5 text-sm text-white/70 hover:border-blood hover:text-blood">
            Log out
          </button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/admin/players">
          <Card className="text-center transition hover:border-neon/50">
            <p className="font-display font-bold">Manage Players</p>
            <p className="mt-1 text-xs text-white/50">Add players, edit prices, CSV import</p>
          </Card>
        </Link>
        <Link href="/admin/teams">
          <Card className="text-center transition hover:border-neon/50">
            <p className="font-display font-bold">Manage Budgets</p>
            <p className="mt-1 text-xs text-white/50">Set auction results &amp; balances</p>
          </Card>
        </Link>
        <Link href="/admin/users">
          <Card className="text-center transition hover:border-neon/50">
            <p className="font-display font-bold">Admin Users</p>
            <p className="mt-1 text-xs text-white/50">Add login accounts for captains</p>
          </Card>
        </Link>
      </div>

      <section>
        <SectionTitle accent>Gameweeks</SectionTitle>
        <Card className="mb-4">
          <form action={createGameweekAction} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-white/50">Number</label>
              <input
                name="number"
                type="number"
                min={1}
                required
                className="w-24 rounded-md border border-ink-border bg-ink-soft px-2 py-1.5 text-sm outline-none focus:border-neon"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-white/50">Label (optional)</label>
              <input
                name="label"
                placeholder="Gameweek 2"
                className="rounded-md border border-ink-border bg-ink-soft px-2 py-1.5 text-sm outline-none focus:border-neon"
              />
            </div>
            <button className="rounded-md bg-neon px-4 py-1.5 font-display font-bold uppercase tracking-wide text-ink hover:bg-neon-glow">
              Add Gameweek
            </button>
          </form>
        </Card>

        <div className="space-y-4">
          {gameweeks.map((gw) => {
            const fixtures = fixturesByGw[gw.id];
            return (
              <Card key={gw.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-bold">{gw.label || `Gameweek ${gw.number}`}</h3>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        gw.status === "active"
                          ? "border-neon/40 text-neon"
                          : gw.status === "completed"
                          ? "border-white/20 text-white/40"
                          : "border-yellow-500/40 text-yellow-300"
                      }`}
                    >
                      {gw.status}
                    </span>
                  </div>
                  {gw.status !== "active" && (
                    <form action={setActiveGameweekAction}>
                      <input type="hidden" name="id" value={gw.id} />
                      <button className="text-xs text-neon underline">Set active</button>
                    </form>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {fixtures.map((f) => {
                    const home = teamsById[f.home_team_id];
                    const away = teamsById[f.away_team_id];
                    return (
                      <div
                        key={f.id}
                        className="flex flex-col gap-2 rounded-md border border-ink-border bg-ink-soft px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="shrink-0 rounded-full border border-ink-border px-1.5 py-0.5 text-[10px] font-display text-white/40">
                            #{f.seq}
                          </span>
                          {home && <TeamBadge name={home.name} color={home.color} />}
                          <span className="truncate">{home?.name}</span>
                          <span className="text-white/40">vs</span>
                          {away && <TeamBadge name={away.name} color={away.color} />}
                          <span className="truncate">{away?.name}</span>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-3">
                          {f.status === "final" ? (
                            <span className="font-display font-bold">
                              {f.home_score} - {f.away_score}
                            </span>
                          ) : (
                            <span className="text-white/40">Not played</span>
                          )}
                          <Link href={`/admin/fixtures/${f.id}`} className="text-neon underline">
                            {f.status === "final" ? "Edit score" : "Enter score"}
                          </Link>
                          {f.status === "final" && (
                            <form action={markFixtureNotPlayedAction}>
                              <input type="hidden" name="id" value={f.id} />
                              <ConfirmButton
                                className="text-yellow-500 underline"
                                confirmMessage="Mark this match as not played? This clears the score, removes every player's stats and points from it, and reverses the win/draw/loss budget bonus it paid out. The fixture stays on the schedule so you can re-enter it."
                              >
                                Mark not played
                              </ConfirmButton>
                            </form>
                          )}
                          <form action={deleteFixtureAction}>
                            <input type="hidden" name="id" value={f.id} />
                            <ConfirmButton
                              className="text-blood underline"
                              confirmMessage={
                                f.status === "final"
                                  ? "Delete this played match? This removes every player's stats and points from it, and reverses the win/draw/loss budget bonus it paid out. This cannot be undone."
                                  : "Remove this fixture?"
                              }
                            >
                              Delete
                            </ConfirmButton>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form action={createFixtureAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-ink-border pt-3">
                  <input type="hidden" name="gameweekId" value={gw.id} />
                  <select
                    name="homeTeamId"
                    required
                    className="rounded-md border border-ink-border bg-ink-soft px-2 py-1.5 text-sm"
                  >
                    <option value="">Home team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="awayTeamId"
                    required
                    className="rounded-md border border-ink-border bg-ink-soft px-2 py-1.5 text-sm"
                  >
                    <option value="">Away team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-md border border-neon/50 px-3 py-1.5 text-sm text-neon hover:bg-neon/10">
                    Add Fixture
                  </button>
                </form>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
