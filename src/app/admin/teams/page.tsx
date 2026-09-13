import { updateTeamBudgetAction } from "@/lib/actions";
import { getAllTeams, getTransactionsForTeam } from "@/lib/queries";
import { Card, SectionTitle, TeamDot, formatMoney } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function AdminTeamsPage() {
  const teams = getAllTeams();

  return (
    <div className="space-y-6">
      <SectionTitle accent>Manage Team Budgets</SectionTitle>
      <p className="-mt-3 text-sm text-white/50">
        Use this once after the auction to set each team&apos;s leftover balance. After that, match result
        bonuses (win +£4M, draw +£2M, loss +£1M) are added automatically when you enter scores.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((t) => {
          const txns = getTransactionsForTeam(t.id) as any[];
          return (
            <Card key={t.id}>
              <div className="flex items-center gap-2">
                <TeamDot color={t.color} />
                <h3 className="font-display text-lg font-bold">{t.name}</h3>
              </div>
              <form action={updateTeamBudgetAction} className="mt-3 flex items-end gap-2">
                <input type="hidden" name="teamId" value={t.id} />
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-white/50">
                    Budget Remaining (£M)
                  </label>
                  <input
                    name="budget"
                    type="number"
                    step="0.1"
                    defaultValue={t.budget_remaining}
                    className="w-32 rounded-md border border-ink-border bg-ink-soft px-2 py-1.5 text-sm outline-none focus:border-neon"
                  />
                </div>
                <button className="rounded-md bg-neon px-3 py-1.5 font-display font-bold uppercase tracking-wide text-ink hover:bg-neon-glow">
                  Set
                </button>
              </form>
              {txns.length > 0 && (
                <div className="mt-3 max-h-32 overflow-y-auto text-xs text-white/50 scrollbar-thin">
                  {txns.slice(0, 6).map((tx) => (
                    <div key={tx.id} className="flex justify-between border-t border-ink-border py-1 first:border-t-0">
                      <span>{tx.reason}</span>
                      <span>{formatMoney(tx.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
