import Link from "next/link";
import { notFound } from "next/navigation";
import { getFixture, getFixtureStatLines, getGameweek, getTeam } from "@/lib/queries";
import { CaptainBadge, Card, PlayerLink, PositionBadge, SectionTitle, TeamBadge, TeamLink } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FixtureDetailPage({ params }: { params: { id: string } }) {
  const fixture = await getFixture(Number(params.id));
  if (!fixture) notFound();

  const [home, away, gameweek, statLines] = await Promise.all([
    getTeam(fixture.home_team_id),
    getTeam(fixture.away_team_id),
    getGameweek(fixture.gameweek_id),
    getFixtureStatLines(fixture.id),
  ]);
  if (!home || !away) notFound();

  const final = fixture.status === "final";

  // Each stat line already carries the team the player was actually on
  // when this fixture was played (not their current team) — a later
  // transfer must never move an already-played match onto a different
  // team's page. Best performers first; non-scorers sink to the bottom.
  const byPointsDesc = (teamId: number) =>
    statLines.filter((s) => s.team_id === teamId).sort((a, b) => b.points - a.points);

  const teamColumns = [
    { team: home, players: byPointsDesc(home.id) },
    { team: away, players: byPointsDesc(away.id) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 text-sm">
        {fixture.prev_id ? (
          <Link href={`/fixtures/${fixture.prev_id}`} className="text-neon transition hover:underline">
            ← Previous game
          </Link>
        ) : (
          <span className="text-white/20">← Previous game</span>
        )}
        {fixture.next_id ? (
          <Link href={`/fixtures/${fixture.next_id}`} className="text-neon transition hover:underline">
            Next game →
          </Link>
        ) : (
          <span className="text-white/20">Next game →</span>
        )}
      </div>

      <Card className="text-center">
        <p className="font-display text-xs uppercase tracking-widest text-neon">
          Game {fixture.seq} of {fixture.total_fixtures} · {gameweek?.label || `Gameweek ${gameweek?.number ?? ""}`} ·{" "}
          {final ? "Full Time" : "Scheduled"}
        </p>
        <div className="mt-3 flex items-center justify-center gap-4 sm:gap-8">
          <TeamLink id={home.id} name={home.name} color={home.color} className="font-display text-lg font-bold sm:text-xl" />
          <span className="font-display text-3xl font-bold sm:text-4xl">
            {final ? `${fixture.home_score} – ${fixture.away_score}` : "vs"}
          </span>
          <TeamLink id={away.id} name={away.name} color={away.color} className="font-display text-lg font-bold sm:text-xl" />
        </div>
      </Card>

      {!final ? (
        <Card>
          <p className="text-center text-sm text-white/60">This fixture hasn&apos;t been played yet.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {teamColumns.map(({ team, players }) => (
            <section key={team.id}>
              <div className="mb-2 flex items-center gap-2">
                <TeamBadge name={team.name} color={team.color} />
                <h3 className="font-display text-base font-bold">{team.name}</h3>
              </div>
              <Card className="divide-y divide-ink-border">
                {players.map((s) => {
                  const played = s.played === 1;
                  return (
                    <div key={s.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <PositionBadge position={s.position} />
                          <PlayerLink
                            id={s.player_id}
                            name={s.player_name}
                            className={`truncate text-sm font-medium ${played ? "" : "text-white/40"}`}
                          />
                          {s.is_captain === 1 && <CaptainBadge size="xs" />}
                        </div>
                        <span className="shrink-0 font-display text-sm font-bold text-neon">
                          {played ? `${s.points} pts` : "DNP"}
                        </span>
                      </div>
                      {played && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-1 text-[11px] text-white/50">
                          {s.goals > 0 && <span>⚽ {s.goals} goal{s.goals > 1 ? "s" : ""}</span>}
                          {s.assists > 0 && <span>🅰️ {s.assists} assist{s.assists > 1 ? "s" : ""}</span>}
                          {s.clean_sheet === 1 && <span>🧤 Clean sheet</span>}
                          {s.blue_cards > 0 && <span>🟦 {s.blue_cards} blue card{s.blue_cards > 1 ? "s" : ""}</span>}
                          {s.penalty_saves > 0 && (
                            <span>🧤 {s.penalty_saves} penalty save{s.penalty_saves > 1 ? "s" : ""}</span>
                          )}
                          {s.penalty_misses > 0 && (
                            <span>❌ {s.penalty_misses} penalty miss{s.penalty_misses > 1 ? "es" : ""}</span>
                          )}
                          {s.own_goals > 0 && (
                            <span>🔴 {s.own_goals} own goal{s.own_goals > 1 ? "s" : ""}</span>
                          )}
                          {s.position === "GK" && s.goals_conceded > 0 && (
                            <span>{s.goals_conceded} conceded</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {players.length === 0 && <p className="text-sm text-white/40">No squad set.</p>}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
