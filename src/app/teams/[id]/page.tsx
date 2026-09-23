import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAllTeams,
  getFixturesByGameweek,
  getGameweeks,
  getPlayersByTeam,
  getTeam,
  getTeamRecords,
  getTotalPointsForPlayer,
  getTransactionsForTeam,
} from "@/lib/queries";
import { Card, PlayerLink, PositionBadge, SectionTitle, StatPill, TeamBadge, formatMoney } from "@/components/ui";
import { POSITIONS } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function TeamDetailPage({ params }: { params: { id: string } }) {
  const team = await getTeam(Number(params.id));
  if (!team) notFound();

  const [players, records, transactions, allTeams, gameweeks] = await Promise.all([
    getPlayersByTeam(team.id),
    getTeamRecords(),
    getTransactionsForTeam(team.id) as Promise<any[]>,
    getAllTeams(),
    getGameweeks(),
  ]);
  const teamsById = Object.fromEntries(allTeams.map((t) => [t.id, t]));
  const record = records[team.id] || { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };

  const playerPointsEntries = await Promise.all(
    players.map(async (p) => [p.id, await getTotalPointsForPlayer(p.id)] as const)
  );
  const playerPoints = Object.fromEntries(playerPointsEntries);
  const totalPoints = Object.values(playerPoints).reduce((a, b) => a + b, 0);

  const fixturesByGw = await Promise.all(gameweeks.map((gw) => getFixturesByGameweek(gw.id)));
  const fixtures = gameweeks.flatMap((gw, i) =>
    fixturesByGw[i]
      .filter((f) => f.home_team_id === team.id || f.away_team_id === team.id)
      .map((f) => ({ ...f, gwLabel: gw.label || `GW${gw.number}` }))
  );

  return (
    <div className="space-y-6">
      <Card className="border-2" style={{ borderColor: `${team.color}55` }}>
        <div className="flex items-center gap-3">
          <TeamBadge name={team.name} color={team.color} size="lg" />
          <div>
            <h1 className="font-display text-2xl font-bold">{team.name}</h1>
            <p className="text-sm text-white/60">Captain: {team.captain}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <StatPill label="Total Points" value={totalPoints} tone="neon" />
          <StatPill label="Budget Left" value={formatMoney(team.budget_remaining)} />
          <StatPill label="Played" value={record.played} />
          <StatPill label="Record" value={`${record.won}-${record.drawn}-${record.lost}`} />
          <StatPill label="GD" value={record.goalsFor - record.goalsAgainst} />
        </div>
      </Card>

      <section>
        <SectionTitle accent>Squad ({players.length}/8)</SectionTitle>
        <div className="space-y-4">
          {POSITIONS.map((pos) => {
            const inPos = players.filter((p) => p.position === pos);
            if (inPos.length === 0) return null;
            return (
              <Card key={pos}>
                <div className="mb-2 flex items-center gap-2">
                  <PositionBadge position={pos} />
                  <span className="text-xs uppercase tracking-wide text-white/40">
                    {pos === "GK" || pos === "FWD" ? "1 required" : "3 required"}
                  </span>
                </div>
                <div className="divide-y divide-ink-border">
                  {inPos.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                      <PlayerLink id={p.id} name={p.name} className="font-medium" />
                      <div className="flex items-center gap-3 text-sm text-white/60">
                        <span>{formatMoney(p.price)}</span>
                        <span className="font-display font-bold text-neon">{playerPoints[p.id] || 0} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
          {players.length === 0 && (
            <Card>
              <p className="text-sm text-white/60">
                Squad not set yet — players will appear here once the auction results are entered.
              </p>
            </Card>
          )}
        </div>
      </section>

      <section>
        <SectionTitle accent>Fixtures</SectionTitle>
        {fixtures.length === 0 ? (
          <Card>
            <p className="text-sm text-white/60">No fixtures scheduled yet.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-ink-border">
            {fixtures.map((f) => {
              const isHome = f.home_team_id === team.id;
              const opponentId = isHome ? f.away_team_id : f.home_team_id;
              const opponent = teamsById[opponentId];
              const score =
                f.status === "final" ? `${isHome ? f.home_score : f.away_score} - ${isHome ? f.away_score : f.home_score}` : "vs";
              return (
                <Link
                  key={f.id}
                  href={`/fixtures/${f.id}`}
                  className="flex items-center justify-between py-2 text-sm transition hover:text-neon first:pt-0 last:pb-0"
                >
                  <span className="text-white/40">
                    {f.gwLabel} <span className="text-white/30">· #{f.seq}</span>
                  </span>
                  <span>
                    {isHome ? "vs" : "@"} {opponent?.name}
                  </span>
                  <span className="font-display font-bold">{score}</span>
                </Link>
              );
            })}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle accent>Transfer Market Balance History</SectionTitle>
        {transactions.length === 0 ? (
          <Card>
            <p className="text-sm text-white/60">No transactions yet.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-ink-border">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0 text-sm">
                <span className="text-white/60">{t.reason}</span>
                <span className={`font-display font-bold ${t.amount >= 0 ? "text-neon" : "text-blood"}`}>
                  {t.amount >= 0 ? "+" : ""}
                  {formatMoney(t.amount)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
