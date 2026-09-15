import { getAllTeams, getPlayersByTeam, getTeamRecords } from "@/lib/queries";
import { Card, SectionTitle, TeamDot, formatMoney } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

const EMPTY_RECORD = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };

export default async function TeamsPage() {
  const teams = await getAllTeams();
  const records = await getTeamRecords();
  const squadCounts = Object.fromEntries(
    await Promise.all(teams.map(async (t) => [t.id, (await getPlayersByTeam(t.id)).length] as const))
  );

  return (
    <div className="space-y-6">
      <SectionTitle accent>Vipers League Teams</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((t) => {
          const r = records[t.id] || EMPTY_RECORD;
          return (
            <Link key={t.id} href={`/teams/${t.id}`}>
              <Card className="h-full transition hover:border-neon/50 hover:shadow-neon">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TeamDot color={t.color} />
                    <h3 className="font-display text-lg font-bold">{t.name}</h3>
                  </div>
                  <span className="font-display text-lg font-bold text-neon">{r.points} pts</span>
                </div>
                <p className="mt-1 text-sm text-white/60">Captain: {t.captain}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-white/50">{squadCounts[t.id] || 0}/8 squad</span>
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
