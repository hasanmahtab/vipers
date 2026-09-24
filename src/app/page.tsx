import Link from "next/link";
import {
  getActiveGameweek,
  getAllFixturesDesc,
  getAllTeams,
  getFplPointsTable,
  getTeamRecords,
} from "@/lib/queries";
import {
  CaptainBadge,
  Card,
  PlayerAvatar,
  PlayerLink,
  PositionBadge,
  RankBadge,
  SectionTitle,
  StatPill,
  TeamBadge,
  TeamLink,
  formatMoney,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const EMPTY_RECORD = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };

export default async function HomePage() {
  const gameweek = await getActiveGameweek();
  const teams = await getAllTeams();
  const records = await getTeamRecords();

  const standings = [...teams].sort(
    (a, b) => (records[b.id]?.points || 0) - (records[a.id]?.points || 0)
  );

  // Newest first — the strip scrolls right to reveal older results.
  const fixtures = await getAllFixturesDesc();

  const fplTable = await getFplPointsTable();
  const topPerformers = fplTable.slice(0, 10);
  const topScorers = [...fplTable]
    .filter((p) => p.total_goals > 0)
    .sort((a, b) => b.total_goals - a.total_goals || b.total_points - a.total_points)
    .slice(0, 5);
  const topAssisters = [...fplTable]
    .filter((p) => p.total_assists > 0)
    .sort((a, b) => b.total_assists - a.total_assists || b.total_points - a.total_points)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#37003c] via-[#3f2172] to-[#0453e0] p-5 shadow-neon">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#0453e0] opacity-40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-[#37003c] opacity-50 blur-3xl" />
        <div className="relative">
          <p className="font-display text-xs uppercase tracking-widest text-[#ffffff]/70">
            {gameweek ? gameweek.label || `Gameweek ${gameweek.number}` : "Season not started"}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#ffffff] sm:text-3xl">This Week in the Vipers League</h1>
          <p className="mt-1 text-sm text-[#ffffff]/80">
            Live scores, standings, and top performers — updated by the league admin after every match.
          </p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <SectionTitle accent>Fixtures &amp; Results</SectionTitle>
          {fixtures.length > 0 && (
            <span className="text-[11px] uppercase tracking-wide text-white/30">Scroll for older →</span>
          )}
        </div>
        {fixtures.length === 0 ? (
          <Card>
            <p className="text-sm text-white/60">No fixtures have been scheduled yet.</p>
          </Card>
        ) : (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-thin sm:mx-0 sm:px-0">
            {fixtures.map((f) => {
              const final = f.status === "final";
              return (
                <Link key={f.id} href={`/fixtures/${f.id}`} className="shrink-0 snap-start">
                  <Card className="h-full w-64 transition hover:border-neon/50 hover:shadow-neon">
                    <p className="mb-2 text-[10px] uppercase tracking-wide text-white/30">
                      {f.gw_label || `Gameweek ${f.gw_number}`} · Game {f.seq}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold">
                        <TeamBadge name={f.home_team_name} color={f.home_team_color} size="sm" />
                        <span className="truncate">{f.home_team_name}</span>
                      </span>
                      <span className="shrink-0 font-display text-lg font-bold">
                        {final ? f.home_score : "–"}
                      </span>
                    </div>
                    <div className="my-1 flex items-center justify-between">
                      <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold">
                        <TeamBadge name={f.away_team_name} color={f.away_team_color} size="sm" />
                        <span className="truncate">{f.away_team_name}</span>
                      </span>
                      <span className="shrink-0 font-display text-lg font-bold">
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
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <SectionTitle accent>Top Performers</SectionTitle>
          <span className="text-[11px] uppercase tracking-wide text-white/30">Season total</span>
        </div>
        {topPerformers.length === 0 ? (
          <Card>
            <p className="text-sm text-white/60">No stats entered yet.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-ink-border">
            {topPerformers.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <RankBadge rank={i + 1} />
                <PlayerAvatar name={p.name} photoUrl={p.photo_url} />
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <PlayerLink id={p.id} name={p.name} className="truncate font-semibold" />
                    {p.is_captain === 1 && <CaptainBadge size="xs" />}
                  </span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {p.position && <PositionBadge position={p.position} />}
                    {p.team_name && p.team_color && (
                      <TeamLink id={p.team_id!} name={p.team_name} color={p.team_color} className="text-xs text-white/50" />
                    )}
                    {p.total_goals > 0 && <span className="text-[11px] text-white/50">⚽ {p.total_goals}</span>}
                    {p.total_assists > 0 && <span className="text-[11px] text-white/50">🅰️ {p.total_assists}</span>}
                    {p.total_clean_sheets > 0 && <span className="text-[11px] text-white/50">🧤 {p.total_clean_sheets}</span>}
                  </div>
                </div>
                <span className="shrink-0 font-display text-lg font-bold text-neon">{p.total_points} pts</span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle accent>Season Leaders</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-white/70">Goals</h3>
            {topScorers.length === 0 ? (
              <p className="text-sm text-white/50">No goals scored yet.</p>
            ) : (
              <div className="divide-y divide-ink-border">
                {topScorers.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <RankBadge rank={i + 1} size="w-4 h-4 text-[10px]" />
                    <PlayerAvatar name={p.name} photoUrl={p.photo_url} />
                    <div className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <PlayerLink id={p.id} name={p.name} className="truncate text-sm font-semibold" />
                        {p.is_captain === 1 && <CaptainBadge size="xs" />}
                      </span>
                      {p.team_name && p.team_color && (
                        <TeamLink id={p.team_id!} name={p.team_name} color={p.team_color} className="text-xs text-white/50" />
                      )}
                    </div>
                    <span className="shrink-0 font-display text-lg font-bold text-neon">{p.total_goals}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-white/70">Assists</h3>
            {topAssisters.length === 0 ? (
              <p className="text-sm text-white/50">No assists recorded yet.</p>
            ) : (
              <div className="divide-y divide-ink-border">
                {topAssisters.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <RankBadge rank={i + 1} size="w-4 h-4 text-[10px]" />
                    <PlayerAvatar name={p.name} photoUrl={p.photo_url} />
                    <div className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <PlayerLink id={p.id} name={p.name} className="truncate text-sm font-semibold" />
                        {p.is_captain === 1 && <CaptainBadge size="xs" />}
                      </span>
                      {p.team_name && p.team_color && (
                        <TeamLink id={p.team_id!} name={p.team_name} color={p.team_color} className="text-xs text-white/50" />
                      )}
                    </div>
                    <span className="shrink-0 font-display text-lg font-bold text-neon">{p.total_assists}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
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
                        <RankBadge rank={i + 1} size="w-5 h-5 text-[11px]" />
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
