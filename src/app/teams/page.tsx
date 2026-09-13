import { getAllTeams, getPlayersByTeam, getTeamRecords, getTotalPointsByTeam } from "@/lib/queries";
import { Card, SectionTitle, TeamDot, formatMoney } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function TeamsPage() {
  const teams = getAllTeams();
  const records = getTeamRecords();
  const totals = getTotalPointsByTeam();

  return (
    <div className="space-y-6">
      <SectionTitle accent>Vipers League Teams</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((t) => {
          const players = getPlayersByTeam(t.id);
          const r = records[t.id] || { played: 0, won: 0, drawn: 0, lost: 0 };
          return (
            <Link key={t.id} href={`/teams/${t.id}`}>
              <Card className="h-full transition hover:border-neon/50 hover:shadow-neon">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TeamDot color={t.color} />
                    <h3 className="font-display text-lg font-bold">{t.name}</h3>
                  </div>
                  <span className="font-display text-lg font-bold text-neon">{totals[t.id] || 0} pts</span>
                </div>
                <p className="mt-1 text-sm text-white/60">Captain: {t.captain}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-white/50">{players.length}/8 squad</span>
                  <span className="text-white/50">
                    {r.played}P {r.won}W {r.drawn}D {r.lost}L
                  </span>
                  <span className="font-semibold text-white/80">{formatMoney(t.budget_remaining)}</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
