import { getAllTeams, getFplPointsTable, getTeamRecords } from "@/lib/queries";
import { Card, PlayerAvatar, PlayerLink, PositionBadge, SectionTitle, TeamLink, formatMoney } from "@/components/ui";

export const dynamic = "force-dynamic";

const EMPTY_RECORD = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };

export default async function TablePage() {
  const teams = await getAllTeams();
  const records = await getTeamRecords();
  const fplTable = await getFplPointsTable();

  const rows = teams
    .map((t) => ({ team: t, record: records[t.id] || EMPTY_RECORD }))
    .sort(
      (a, b) =>
        b.record.points - a.record.points ||
        b.record.goalsFor - b.record.goalsAgainst - (a.record.goalsFor - a.record.goalsAgainst)
    );

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle accent>League Table</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-white/40">
                <th className="pb-2">#</th>
                <th className="pb-2">Team</th>
                <th className="pb-2 text-center">P</th>
                <th className="pb-2 text-center">W</th>
                <th className="pb-2 text-center">D</th>
                <th className="pb-2 text-center">L</th>
                <th className="pb-2 text-center">GF</th>
                <th className="pb-2 text-center">GA</th>
                <th className="pb-2 text-center">GD</th>
                <th className="pb-2 text-center">Budget</th>
                <th className="pb-2 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.team.id} className="border-t border-ink-border">
                  <td className="py-2 text-white/40">{i + 1}</td>
                  <td className="py-2">
                    <TeamLink id={row.team.id} name={row.team.name} color={row.team.color} className="font-semibold" />
                  </td>
                  <td className="py-2 text-center">{row.record.played}</td>
                  <td className="py-2 text-center">{row.record.won}</td>
                  <td className="py-2 text-center">{row.record.drawn}</td>
                  <td className="py-2 text-center">{row.record.lost}</td>
                  <td className="py-2 text-center">{row.record.goalsFor}</td>
                  <td className="py-2 text-center">{row.record.goalsAgainst}</td>
                  <td className="py-2 text-center">{row.record.goalsFor - row.record.goalsAgainst}</td>
                  <td className="py-2 text-center">{formatMoney(row.team.budget_remaining)}</td>
                  <td className="py-2 text-right font-display font-bold text-neon">{row.record.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <SectionTitle accent>FPL Points</SectionTitle>
          <span className="text-[11px] uppercase tracking-wide text-white/30">Every player, ranked</span>
        </div>
        {fplTable.length === 0 ? (
          <Card>
            <p className="text-sm text-white/60">No players have been drafted onto a team yet.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-ink-border">
            {fplTable.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="w-6 shrink-0 text-center font-display text-sm text-white/40">{i + 1}</span>
                <PlayerAvatar name={p.name} photoUrl={p.photo_url} />
                <div className="min-w-0 flex-1">
                  <PlayerLink id={p.id} name={p.name} className="font-semibold" />
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {p.position && <PositionBadge position={p.position} />}
                    {p.team_name && p.team_color && (
                      <TeamLink id={p.team_id!} name={p.team_name} color={p.team_color} className="text-xs text-white/50" />
                    )}
                    <span className="text-[11px] text-white/40">{formatMoney(p.price)}</span>
                  </div>
                </div>
                <span className="shrink-0 font-display text-lg font-bold text-neon">{p.total_points} pts</span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
