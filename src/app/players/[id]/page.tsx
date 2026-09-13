import { notFound } from "next/navigation";
import { getPlayer, getStatsForPlayer, getTeam, getTotalPointsForPlayer } from "@/lib/queries";
import { Card, PositionBadge, SectionTitle, StatPill, TeamLink, formatMoney } from "@/components/ui";
import { POSITION_LABEL } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function PlayerDetailPage({ params }: { params: { id: string } }) {
  const player = await getPlayer(Number(params.id));
  if (!player) notFound();

  const team = player.team_id ? await getTeam(player.team_id) : undefined;
  const totalPoints = await getTotalPointsForPlayer(player.id);
  const history = await getStatsForPlayer(player.id);

  const totalGoals = history.reduce((a, h) => a + h.goals, 0);
  const totalAssists = history.reduce((a, h) => a + h.assists, 0);
  const cleanSheets = history.filter((h) => h.clean_sheet).length;
  const appearances = history.filter((h) => h.played).length;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              {player.position ? (
                <>
                  <PositionBadge position={player.position} />
                  <span className="text-xs uppercase tracking-wide text-white/40">{POSITION_LABEL[player.position]}</span>
                </>
              ) : (
                <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-[11px] font-display font-semibold uppercase tracking-wide text-yellow-300">
                  Undrafted
                </span>
              )}
              {player.is_captain === 1 && (
                <span className="rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-[11px] font-display font-semibold uppercase tracking-wide text-neon">
                  Captain
                </span>
              )}
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold">{player.name}</h1>
            {team ? (
              <TeamLink id={team.id} name={team.name} color={team.color} className="mt-1 text-sm text-white/60" />
            ) : (
              <p className="mt-1 text-sm text-white/50">Not yet drafted to a team</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-bold text-neon">{totalPoints}</p>
            <p className="text-[11px] uppercase tracking-wide text-white/40">points this season</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <StatPill label="Price" value={formatMoney(player.price)} />
          <StatPill label="Apps" value={appearances} />
          <StatPill label="Goals" value={totalGoals} tone="neon" />
          <StatPill label="Assists" value={totalAssists} tone="neon" />
          <StatPill label="Clean Sheets" value={cleanSheets} />
          <StatPill label="Last Season Pts" value={player.last_season_points} />
        </div>
      </Card>

      <section>
        <SectionTitle accent>Gameweek by Gameweek</SectionTitle>
        {history.length === 0 ? (
          <Card>
            <p className="text-sm text-white/60">No match data recorded yet for {player.name}.</p>
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-white/40">
                  <th className="pb-2">GW</th>
                  <th className="pb-2 text-center">Played</th>
                  <th className="pb-2 text-center">G</th>
                  <th className="pb-2 text-center">A</th>
                  <th className="pb-2 text-center">CS</th>
                  <th className="pb-2 text-center">Conceded</th>
                  <th className="pb-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-ink-border">
                    <td className="py-2">{h.gameweek.label || `GW${h.gameweek.number}`}</td>
                    <td className="py-2 text-center">{h.played ? "Yes" : "No"}</td>
                    <td className="py-2 text-center">{h.goals}</td>
                    <td className="py-2 text-center">{h.assists}</td>
                    <td className="py-2 text-center">{h.clean_sheet ? "Yes" : "-"}</td>
                    <td className="py-2 text-center">{h.goals_conceded}</td>
                    <td className="py-2 text-right font-display font-bold text-neon">{h.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
