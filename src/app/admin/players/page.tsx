import {
  addPlayerAction,
  assignPlayerAction,
  deletePlayerAction,
  importPlayersCsvAction,
  syncFinalSquadAction,
  unassignPlayerAction,
  updatePlayerAction,
} from "@/lib/actions";
import { getAllTeams, getPlayersByTeam, getUnassignedPlayers } from "@/lib/queries";
import { Card, PositionBadge, SectionTitle, TeamBadge, formatMoney } from "@/components/ui";
import { POSITIONS } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const POSITION_LIMITS: Record<string, number> = { GK: 1, DEF: 3, MID: 2, FWD: 2 };

export default async function AdminPlayersPage() {
  const teams = await getAllTeams();
  const pool = await getUnassignedPlayers();
  const squadsByTeam = Object.fromEntries(
    await Promise.all(teams.map(async (t) => [t.id, await getPlayersByTeam(t.id)] as const))
  );

  return (
    <div className="space-y-8">
      <SectionTitle accent>Manage Players</SectionTitle>

      <section>
        <h3 className="mb-3 font-display text-lg font-bold">
          Draft Pool <span className="text-white/40 text-sm font-body font-normal">({pool.length} undrafted)</span>
        </h3>
        <p className="mb-3 text-sm text-white/60">
          Everyone registered for the league, with last season&apos;s points. Once the auction decides who
          goes where, assign each player a team, position, and price here — the squad shape (1 GK, 3 DEF, 2
          MID, 2 FWD) is enforced automatically.
        </p>
        <form action={syncFinalSquadAction} className="mb-4">
          <Card className="border-neon/30 bg-neon/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display font-bold text-neon">Sync to Final Squad List (one-time)</p>
                <p className="mt-1 text-xs text-white/60">
                  Applies the confirmed roster: removes Mahfuz Haque and Sajid Khalid (not playing), adds
                  Nabil Shahriar (GK) and Shadman Sakib (MID, in Sajid&apos;s place) onto Blackouts FC and
                  Darkstar FC for now, sets everyone&apos;s locked-in position for the season, and sends
                  every non-captain back to the pool below — ready for the real auction to assign team and
                  price. Safe to click more than once.
                </p>
              </div>
              <button className="shrink-0 rounded-md bg-neon px-4 py-2 font-display font-bold uppercase tracking-wide text-ink hover:bg-neon-glow">
                Sync Final Squad
              </button>
            </div>
          </Card>
        </form>
        {pool.length === 0 ? (
          <Card>
            <p className="text-sm text-white/60">Every registered player has been drafted onto a team.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-ink-border">
            {pool.map((p) => (
              <form
                key={p.id}
                action={assignPlayerAction}
                className="grid grid-cols-2 items-center gap-2 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto_auto_auto_auto]"
              >
                <input type="hidden" name="id" value={p.id} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{p.name}</span>
                    {p.is_captain === 1 && (
                      <span className="rounded-full border border-neon/40 bg-neon/10 px-1.5 py-0.5 text-[9px] font-display font-semibold uppercase tracking-wide text-neon">
                        C
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-white/40">{p.last_season_points} pts last season</span>
                </div>
                <select
                  name="teamId"
                  required
                  className="rounded-md border border-ink-border bg-ink-soft px-2 py-1.5 text-sm"
                >
                  <option value="">Team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select
                  name="position"
                  required
                  className="rounded-md border border-ink-border bg-ink-soft px-2 py-1.5 text-sm"
                >
                  <option value="">Position</option>
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
                <input
                  name="price"
                  type="number"
                  step="0.1"
                  min={0}
                  required
                  placeholder="Price £M"
                  className="w-24 rounded-md border border-ink-border bg-ink-soft px-2 py-1.5 text-sm"
                />
                <button className="rounded-md bg-neon px-3 py-1.5 text-sm font-display font-bold uppercase tracking-wide text-ink hover:bg-neon-glow">
                  Draft
                </button>
              </form>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg font-bold">Team Squads</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((t) => {
            const squad = squadsByTeam[t.id];
            const counts = squad.reduce<Record<string, number>>((acc, p) => {
              if (p.position) acc[p.position] = (acc[p.position] || 0) + 1;
              return acc;
            }, {});
            return (
              <Card key={t.id}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TeamBadge name={t.name} color={t.color} />
                    <h4 className="font-display font-bold">{t.name}</h4>
                  </div>
                  <span className="text-xs text-white/40">{squad.length}/8</span>
                </div>
                <div className="mb-2 flex gap-2 text-[11px] text-white/40">
                  {POSITIONS.map((pos) => (
                    <span key={pos}>
                      {pos} {counts[pos] || 0}/{POSITION_LIMITS[pos]}
                    </span>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {squad.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-ink-border bg-ink-soft px-2.5 py-1.5 text-sm">
                      <div className="flex items-center gap-2 truncate">
                        <PositionBadge position={p.position!} />
                        <span className="truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-white/50">{formatMoney(p.price)}</span>
                        <form action={unassignPlayerAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className="text-xs text-blood underline">Undraft</button>
                        </form>
                      </div>
                    </div>
                  ))}
                  {squad.length === 0 && <p className="text-sm text-white/40">No players drafted yet.</p>}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg font-bold">Edit Squad Player</h3>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-white/40">
                <th className="pb-2">Team</th>
                <th className="pb-2">Player</th>
                <th className="pb-2">Pos</th>
                <th className="pb-2">Price</th>
                <th className="pb-2">Last Season</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.flatMap((t) =>
                squadsByTeam[t.id].map((p) => (
                  <tr key={p.id} className="border-t border-ink-border align-top">
                    <td className="py-2">{t.name}</td>
                    <td className="py-2">
                      <form action={updatePlayerAction} className="flex flex-wrap items-center gap-1">
                        <input type="hidden" name="id" value={p.id} />
                        <input
                          name="name"
                          defaultValue={p.name}
                          className="w-32 rounded border border-ink-border bg-ink-soft px-1.5 py-1"
                        />
                        <select
                          name="position"
                          defaultValue={p.position ?? ""}
                          className="rounded border border-ink-border bg-ink-soft px-1.5 py-1"
                        >
                          {POSITIONS.map((pos) => (
                            <option key={pos} value={pos}>
                              {pos}
                            </option>
                          ))}
                        </select>
                        <input
                          name="price"
                          type="number"
                          step="0.1"
                          defaultValue={p.price}
                          className="w-16 rounded border border-ink-border bg-ink-soft px-1.5 py-1"
                        />
                        <input
                          name="lastSeasonPoints"
                          type="number"
                          defaultValue={p.last_season_points}
                          className="w-20 rounded border border-ink-border bg-ink-soft px-1.5 py-1"
                        />
                        <button className="text-xs text-neon underline">Save</button>
                      </form>
                    </td>
                    <td className="py-2">{p.position && <PositionBadge position={p.position} />}</td>
                    <td className="py-2">{formatMoney(p.price)}</td>
                    <td className="py-2">{p.last_season_points}</td>
                    <td className="py-2 text-right">
                      <form action={deletePlayerAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="text-xs text-blood underline">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h3 className="mb-3 font-display text-lg font-bold">Add a New Player Directly</h3>
        <p className="mb-2 text-sm text-white/50">
          For anyone not in the original registered list (a late replacement, for example).
        </p>
        <Card>
          <form action={addPlayerAction} className="grid gap-3 sm:grid-cols-5">
            <select name="teamId" required className="rounded-md border border-ink-border bg-ink-soft px-2 py-2 text-sm">
              <option value="">Team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              name="name"
              required
              placeholder="Player name"
              className="rounded-md border border-ink-border bg-ink-soft px-2 py-2 text-sm sm:col-span-2"
            />
            <select name="position" required className="rounded-md border border-ink-border bg-ink-soft px-2 py-2 text-sm">
              <option value="">Position</option>
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
            <input
              name="price"
              type="number"
              step="0.1"
              min={0}
              placeholder="Price (M)"
              className="rounded-md border border-ink-border bg-ink-soft px-2 py-2 text-sm"
            />
            <input
              name="lastSeasonPoints"
              type="number"
              placeholder="Last season pts"
              className="rounded-md border border-ink-border bg-ink-soft px-2 py-2 text-sm sm:col-span-2"
            />
            <button className="rounded-md bg-neon px-4 py-2 font-display font-bold uppercase tracking-wide text-ink hover:bg-neon-glow sm:col-span-1">
              Add
            </button>
          </form>
        </Card>
      </section>

      <section>
        <h3 className="mb-2 font-display text-lg font-bold">Bulk Import from CSV</h3>
        <Card>
          <p className="mb-3 text-sm text-white/60">
            Columns required: <code className="text-neon">team, name, position</code>. Optional:{" "}
            <code className="text-neon">price, last_season_points</code>. Team names must match exactly
            (Blackouts FC, Darkstar FC, Showstoppers, Goli Underdogs).
          </p>
          <form action={importPlayersCsvAction} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neon file:px-3 file:py-1.5 file:font-display file:font-bold file:text-ink"
            />
            <button className="rounded-md border border-neon/50 px-3 py-1.5 text-sm text-neon hover:bg-neon/10">
              Import
            </button>
          </form>
        </Card>
      </section>
    </div>
  );
}
