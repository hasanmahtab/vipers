import { notFound } from "next/navigation";
import { markFixtureNotPlayedAction, submitFixtureScoreAction } from "@/lib/actions";
import { getFixture, getPlayersByTeam, getStatsForFixture, getTeam } from "@/lib/queries";
import { CaptainBadge, Card, PositionBadge, SectionTitle, TeamBadge } from "@/components/ui";
import { SelectAllCheckbox } from "@/components/SelectAllCheckbox";
import { ConfirmButton } from "@/components/ConfirmButton";

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle accent>
          Enter Score: {home.name} vs {away.name}
        </SectionTitle>
        {fixture.status === "final" && (
          <form action={markFixtureNotPlayedAction}>
            <input type="hidden" name="id" value={fixture.id} />
            <ConfirmButton
              className="text-sm text-yellow-500 underline"
              confirmMessage="Mark this match as not played? This clears the score, removes every player's stats and points from it, and reverses the win/draw/loss budget bonus it paid out. The fixture stays on the schedule so you can re-enter it."
            >
              Mark not played
            </ConfirmButton>
          </form>
        )}
      </div>

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
            from the score line above and each player&apos;s &quot;Played&quot; checkbox — just enter goals,
            assists, blue cards, penalty saves, penalty misses, and own goals for whoever&apos;s involved.
          </p>
        </Card>

        {[
          { team: home, players: homePlayers },
          { team: away, players: awayPlayers },
        ].map(({ team, players }) => (
          <Card key={team.id} data-select-all-scope>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TeamBadge name={team.name} color={team.color} />
                <h3 className="font-display text-lg font-bold">{team.name}</h3>
              </div>
              {players.length > 0 && (
                <SelectAllCheckbox targetSelector='input[name^="played_"]' label="Mark all played" />
              )}
            </div>
            <div className="space-y-2">
              {players.length === 0 && <p className="text-sm text-white/50">No players in this squad yet.</p>}
              {players.map((p) => {
                const existing = existingStats.get(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-2 rounded-md border border-ink-border bg-ink-soft px-3 py-2 text-sm sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <PositionBadge position={p.position!} />
                        <span className="truncate">{p.name}</span>
                        {p.is_captain === 1 && <CaptainBadge size="xs" />}
                      </span>
                      <label className="flex shrink-0 items-center gap-1 text-xs text-white/60">
                        <input
                          type="checkbox"
                          name={`played_${p.id}`}
                          defaultChecked={existing ? existing.played === 1 : false}
                          className="h-4 w-4 accent-neon"
                        />
                        Played
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:contents">
                      <label className="flex flex-col items-center gap-1 text-[11px] text-white/60 sm:flex-row sm:text-xs">
                        <input
                          type="number"
                          min={0}
                          name={`goals_${p.id}`}
                          defaultValue={existing?.goals ?? 0}
                          className="w-full rounded border border-ink-border bg-ink px-1.5 py-1 text-center outline-none focus:border-neon sm:w-14"
                        />
                        Goals
                      </label>
                      <label className="flex flex-col items-center gap-1 text-[11px] text-white/60 sm:flex-row sm:text-xs">
                        <input
                          type="number"
                          min={0}
                          name={`assists_${p.id}`}
                          defaultValue={existing?.assists ?? 0}
                          className="w-full rounded border border-ink-border bg-ink px-1.5 py-1 text-center outline-none focus:border-neon sm:w-14"
                        />
                        Assists
                      </label>
                      <label className="flex flex-col items-center gap-1 text-[11px] text-white/60 sm:flex-row sm:text-xs">
                        <input
                          type="number"
                          min={0}
                          name={`blue_${p.id}`}
                          defaultValue={existing?.blue_cards ?? 0}
                          className="w-full rounded border border-ink-border bg-ink px-1.5 py-1 text-center outline-none focus:border-neon sm:w-14"
                        />
                        Blue
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:contents">
                      <label className="flex flex-col items-center gap-1 text-[11px] text-white/60 sm:flex-row sm:text-xs">
                        <input
                          type="number"
                          min={0}
                          name={`pensave_${p.id}`}
                          defaultValue={existing?.penalty_saves ?? 0}
                          className="w-full rounded border border-ink-border bg-ink px-1.5 py-1 text-center outline-none focus:border-neon sm:w-14"
                        />
                        Pen Save
                      </label>
                      <label className="flex flex-col items-center gap-1 text-[11px] text-white/60 sm:flex-row sm:text-xs">
                        <input
                          type="number"
                          min={0}
                          name={`penmiss_${p.id}`}
                          defaultValue={existing?.penalty_misses ?? 0}
                          className="w-full rounded border border-ink-border bg-ink px-1.5 py-1 text-center outline-none focus:border-neon sm:w-14"
                        />
                        Pen Miss
                      </label>
                      <label className="flex flex-col items-center gap-1 text-[11px] text-white/60 sm:flex-row sm:text-xs">
                        <input
                          type="number"
                          min={0}
                          name={`owngoal_${p.id}`}
                          defaultValue={existing?.own_goals ?? 0}
                          className="w-full rounded border border-ink-border bg-ink px-1.5 py-1 text-center outline-none focus:border-neon sm:w-14"
                        />
                        Own Goal
                      </label>
                    </div>
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
