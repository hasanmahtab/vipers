import Link from "next/link";
import {
  getActiveGameweek,
  getAllTeams,
  getFixturesByGameweek,
  getTeamRecords,
  getTopPerformers,
} from "@/lib/queries";
import { Card, PlayerLink, PositionBadge, SectionTitle, StatPill, TeamBadge, TeamLink, formatMoney } from "@/components/ui";

export const dynamic = "force-dynamic";

const EMPTY_RECORD = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };

export default async function HomePage() {
  const gameweek = await getActiveGameweek();
  const teams = await getAllTeams();
  const records = await getTeamRecords();
  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));

  const standings = [...teams].sort(
    (a, b) => (records[b.id]?.points || 0) - (records[a.id]?.points || 0)
  );

  const fixtures = gameweek ? await getFixturesByGameweek(gameweek.id) : [];
  const topPerformers = gameweek ? await getTopPerformers(gameweek.id, 10) : [];

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-neon/30 bg-gradient-to-br from-ink-card to-ink-soft p-5 shadow-neon">
        <p className="font-display text-xs uppercase tracking-widest text-neon">
          {gameweek ? gameweek.label || `Gameweek ${gameweek.number}` : "Season not started"}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">This Week in the Vipers League</h1>
        <p className="mt-1 text-sm text-white/60">
          Live scores, standings, and top performers — updated by the league admin after every match.
        </p>
      </section>

      <section>
        <SectionTitle accent>Fixtures &amp; Results</SectionTitle>
        {fixtures.length === 0 ? (
          <Card>
            <p className="text-sm text-white/60">No fixtures have been scheduled for this gameweek yet.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {fixtures.map((f) => {
              const home = teamsById[f.home_team_id];
              const away = teamsById[f.away_team_id];
              const final = f.status === "final";
              return (
                <Link key={f.id} href={`/fixtures/${f.id}`}>
                  <Card className="h-full transition hover:border-neon/50 hover:shadow-neon">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <TeamBadge name={home.name} color={home.color} size="sm" />
                        {home.name}
                      </span>
                      <span className="font-display text-lg font-bold">
                        {final ? f.home_score : "–"}
                      </span>
                    </div>
                    <div className="my-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <TeamBadge name={away.name} color={away.color} size="sm" />
                        {away.name}
                      </span>
                      <span className="font-display text-lg font-bold">
                        {final ? f.away_score : "–"}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-white/40">
                      {final ? "Full time — view details" : "Scheduled"}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle accent>Top Performers This Week</SectionTitle>
        {topPerformers.length === 0 ? (
          <Card>
            <p className="text-sm text-white/60">No stats entered for this gameweek yet.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-ink-border">
            {topPerformers.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="w-5 shrink-0 text-center font-display text-sm text-white/40">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <PlayerLink id={p.player_id} name={p.player_name} className="font-semibold" />
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <PositionBadge position={p.position} />
                    <TeamLink id={p.team_id} name={p.team_name} color={p.team_color} className="text-xs text-white/50" />
                    {p.goals > 0 && <span className="text-[11px] text-white/50">⚽ {p.goals}</span>}
                    {p.assists > 0 && <span className="text-[11px] text-white/50">🅰️ {p.assists}</span>}
                    {p.clean_sheet === 1 && <span className="text-[11px] text-white/50">🧤 CS</span>}
                  </div>
                </div>
                <span className="shrink-0 font-display text-lg font-bold text-neon">{p.points} pts</span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle accent>League Standings</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-white/40">
                <th className="pb-2">Team</th>
                <th className="pb-2 text-center">P</th>
                <th className="pb-2 text-center">W-D-L</th>
                <th className="pb-2 text-center">Budget</th>
                <th className="pb-2 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((t, i) => {
                const r = records[t.id] || EMPTY_RECORD;
                return (
                  <tr key={t.id} className="border-t border-ink-border">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 w-4">{i + 1}</span>
                        <TeamLink id={t.id} name={t.name} color={t.color} className="font-semibold" />
                      </div>
                    </td>
                    <td className="py-2 text-center text-white/70">{r.played}</td>
                    <td className="py-2 text-center text-white/70">
                      {r.won}-{r.drawn}-{r.lost}
                    </td>
                    <td className="py-2 text-center text-white/70">{formatMoney(t.budget_remaining)}</td>
                    <td className="py-2 text-right font-display font-bold text-neon">{r.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>

      <div className="flex flex-wrap gap-3">
        <StatPill label="Teams" value={teams.length} />
        <StatPill label="Squad Size" value={8} />
        <StatPill label="Starting 7" value={7} tone="neon" />
        <StatPill label="Auction Budget" value="£100M" tone="neon" />
      </div>

      <p className="text-center text-xs text-white/30">
        Full points breakdown on every <Link href="/teams" className="text-neon underline">team</Link> and player page. See all past results on the{" "}
        <Link href="/fixtures" className="text-neon underline">match history</Link> page.
      </p>
    </div>
  );
}
