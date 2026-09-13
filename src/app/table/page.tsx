import { getAllTeams, getTeamRecords, getTotalPointsByTeam } from "@/lib/queries";
import { Card, SectionTitle, TeamLink, formatMoney } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function TablePage() {
  const teams = getAllTeams();
  const records = getTeamRecords();
  const totals = getTotalPointsByTeam();

  const rows = teams
    .map((t) => ({ team: t, record: records[t.id] || { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 }, points: totals[t.id] || 0 }))
    .sort((a, b) => b.points - a.points);

  return (
    <div className="space-y-6">
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
              <th className="pb-2 text-right">Fantasy Pts</th>
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
                <td className="py-2 text-right font-display font-bold text-neon">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-white/70">How points work</h3>
        <ul className="space-y-1 text-sm text-white/60">
          <li>• +2 pts for playing in a fixture</li>
          <li>• Clean sheet: GK +5, DEF +5, MID +1</li>
          <li>• Goal: GK +10, DEF +6, MID +5, FWD +4</li>
          <li>• Assist: +3 pts</li>
          <li>• −1 pt for every 2 goals conceded (GK &amp; DEF only)</li>
        </ul>
      </Card>
    </div>
  );
}
