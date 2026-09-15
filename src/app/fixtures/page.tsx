import Link from "next/link";
import { getAllFixturesDesc } from "@/lib/queries";
import { Card, SectionTitle, TeamDot } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MatchHistoryPage() {
  const fixtures = await getAllFixturesDesc();

  const byGameweek = new Map<string, typeof fixtures>();
  for (const f of fixtures) {
    const label = f.gw_label || `Gameweek ${f.gw_number}`;
    if (!byGameweek.has(label)) byGameweek.set(label, []);
    byGameweek.get(label)!.push(f);
  }

  return (
    <div className="space-y-6">
      <SectionTitle accent>Match History</SectionTitle>
      {fixtures.length === 0 ? (
        <Card>
          <p className="text-sm text-white/60">No fixtures scheduled yet.</p>
        </Card>
      ) : (
        Array.from(byGameweek.entries()).map(([label, gwFixtures]) => (
          <section key={label}>
            <h3 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-white/50">{label}</h3>
            <Card className="divide-y divide-ink-border">
              {gwFixtures.map((f) => {
                const final = f.status === "final";
                return (
                  <Link
                    key={f.id}
                    href={`/fixtures/${f.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm transition hover:text-neon first:pt-0 last:pb-0"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      <TeamDot color={f.home_team_color} />
                      <span className="truncate">{f.home_team_name}</span>
                    </span>
                    <span className="shrink-0 font-display font-bold">
                      {final ? `${f.home_score} - ${f.away_score}` : "vs"}
                    </span>
                    <span className="flex min-w-0 items-center justify-end gap-1.5 truncate text-right">
                      <span className="truncate">{f.away_team_name}</span>
                      <TeamDot color={f.away_team_color} />
                    </span>
                  </Link>
                );
              })}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
