import { notFound } from "next/navigation";
import { submitFixtureScoreAction } from "@/lib/actions";
import { getFixture, getPlayersByTeam, getStatsForFixture, getTeam } from "@/lib/queries";
import { Card, PositionBadge, SectionTitle, TeamBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FixtureScorePage({ params }: { params: { id: string } }) {
  const fixture = await getFixture(Number(params.id));
  if (!fixture) notFound();

  const home = (await getTeam(fixture.home_team_id))!;
  const away = (await getTeam(fixture.away_team_id))!;
  const homePlayers = await getPlayersByTeam(home.id);
  const awayPlayers = await getPlayersByTeam(away.id);
  const existingStats = new Map((await getStatsForFixture(fixture.id)).map((s) => [s.player_id, s]));

  return (
    <div className="space-y-6">
      <SectionTitle accent>
        Enter Score: {home.name} vs {away.name}
      </SectionTitle>

      <form action={submitFixtureScoreAction} className="space-y-6">
        <input type="hidden" name="fixtureId" value={fixture.id} />

        <Card>
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <TeamBadge name={home.name} color={home.color} size="md" />
              <p className="mt-1 font-display font-bold">{home.name}</p>
              <input
                name="homeScore"
                type="number"
                min={0}
                required
                defaultValue={fixture.home_score ?? undefined}
                className="mt-2 w-20 rounded-md border border-ink-border bg-ink-soft px-2 py-2 text-center font-display text-2xl font-bold outline-none focus:border-neon"
              />
            </div>
            <span className="font-display text-2xl text-white/30">–</span>
            <div className="text-center">
              <TeamBadge name={away.name} color={away.color} size="md" />
              <p className="mt-1 font-display font-bold">{away.name}</p>
              <input
                name="awayScore"
                type="number"
                min={0}
                required
                defaultValue={fixture.away_score ?? undefined}
                className="mt-2 w-20 rounded-md border border-ink-border bg-ink-soft px-2 py-2 text-center font-display text-2xl font-bold outline-none focus:border-neon"
              />
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-white/40">
            Clean sheets, goals-conceded penalties, and appearance points are calculated automatically
            from the score line above and each player&apos;s &quot;Played&quot; checkbox — you only need to
            enter who scored and who assisted.
          </p>
        </Card>

        {[
          { team: home, players: homePlayers },
          { team: away, players: awayPlayers },
        ].map(({ team, players }) => (
          <Card key={team.id}>
            <div className="mb-3 flex items-center gap-2">
              <TeamBadge name={team.name} color={team.color} />
              <h3 className="font-display text-lg font-bold">{team.name}</h3>
            </div>
            <div className="space-y-2">
              {players.length === 0 && <p className="text-sm text-white/50">No players in this squad yet.</p>}
              {players.map((p) => {
                const existing = existingStats.get(p.id);
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 rounded-md border border-ink-border bg-ink-soft px-3 py-2 text-sm sm:grid-cols-[1fr_auto_auto_auto_auto]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <PositionBadge position={p.position!} />
                      <span className="truncate">{p.name}</span>
                    </div>
                    <label className="flex items-center gap-1 text-xs text-white/60">
                      <input
                        type="checkbox"
                        name={`played_${p.id}`}
                        defaultChecked={existing ? existing.played === 1 : false}
                        className="h-4 w-4 accent-neon"
                      />
                      Played
                    </label>
                    <label className="flex items-center gap-1 text-xs text-white/60">
                      <input
                        type="number"
                        min={0}
                        name={`goals_${p.id}`}
                        defaultValue={existing?.goals ?? 0}
                        className="w-14 rounded border border-ink-border bg-ink px-1.5 py-1 text-center outline-none focus:border-neon"
                      />
                      Goals
                    </label>
                    <label className="flex items-center gap-1 text-xs text-white/60">
                      <input
                        type="number"
                        min={0}
                        name={`assists_${p.id}`}
                        defaultValue={existing?.assists ?? 0}
                        className="w-14 rounded border border-ink-border bg-ink px-1.5 py-1 text-center outline-none focus:border-neon"
                      />
                      Assists
                    </label>
                    <label className="flex items-center gap-1 text-xs text-white/60">
                      <input
                        type="number"
                        min={0}
                        name={`blue_${p.id}`}
                        defaultValue={existing?.blue_cards ?? 0}
                        className="w-14 rounded border border-ink-border bg-ink px-1.5 py-1 text-center outline-none focus:border-neon"
                      />
                      Blue
                    </label>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}

        <button
          type="submit"
          className="w-full rounded-md bg-neon py-3 font-display text-lg font-bold uppercase tracking-wide text-ink hover:bg-neon-glow"
        >
          Save Score &amp; Calculate Points
        </button>
      </form>
    </div>
  );
}
