"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, run, get, all } from "./db";
import {
  createSessionToken,
  getCurrentAdmin,
  getSessionCookieName,
  getSessionMaxAge,
  verifyLogin,
} from "./auth";
import { calculatePlayerMatchPoints, outcomeFor, Position, RESULT_BONUS } from "./scoring";
import { getPlayersByTeam } from "./queries";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Not authenticated");
  return admin;
}

// ---------- Auth ----------

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/admin");

  const user = await verifyLogin(username, password);
  if (!user) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const token = await createSessionToken(user!);
  cookies().set(getSessionCookieName(), token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: getSessionMaxAge(),
  });

  redirect(next || "/admin");
}

export async function logoutAction() {
  cookies().delete(getSessionCookieName());
  redirect("/admin/login");
}

// ---------- Gameweeks ----------

export async function createGameweekAction(formData: FormData) {
  await requireAdmin();
  const number = Number(formData.get("number"));
  const label = String(formData.get("label") || "").trim() || null;
  if (!number || number < 1) throw new Error("Invalid gameweek number");

  await run("INSERT INTO gameweeks (number, label, status) VALUES (?, ?, 'upcoming')", [number, label]);

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function setActiveGameweekAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const db = await getDb();
  await db.batch(
    [
      { sql: "UPDATE gameweeks SET status = 'completed' WHERE status = 'active'", args: [] },
      { sql: "UPDATE gameweeks SET status = 'active' WHERE id = ?", args: [id] },
    ],
    "write"
  );

  revalidatePath("/admin");
  revalidatePath("/");
}

// ---------- Fixtures ----------

export async function createFixtureAction(formData: FormData) {
  await requireAdmin();
  const gameweekId = Number(formData.get("gameweekId"));
  const homeTeamId = Number(formData.get("homeTeamId"));
  const awayTeamId = Number(formData.get("awayTeamId"));

  if (!gameweekId || !homeTeamId || !awayTeamId) throw new Error("Missing fields");
  if (homeTeamId === awayTeamId) throw new Error("A team cannot play itself");

  await run(
    "INSERT INTO fixtures (gameweek_id, home_team_id, away_team_id, status) VALUES (?, ?, ?, 'scheduled')",
    [gameweekId, homeTeamId, awayTeamId]
  );

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deleteFixtureAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));

  const fixture = await get<{ id: number; status: string }>("SELECT id, status FROM fixtures WHERE id = ?", [id]);
  if (!fixture) return;

  const statements: { sql: string; args: (string | number)[] }[] = [];

  if (fixture.status === "final") {
    // Reverse the win/draw/loss budget bonus this fixture handed out before removing it.
    const txns = await all<{ team_id: number; amount: number }>(
      "SELECT team_id, amount FROM transactions WHERE fixture_id = ?",
      [id]
    );
    for (const t of txns) {
      statements.push({
        sql: "UPDATE teams SET budget_remaining = budget_remaining - ? WHERE id = ?",
        args: [t.amount, t.team_id],
      });
    }
    statements.push({ sql: "DELETE FROM transactions WHERE fixture_id = ?", args: [id] });
  }

  // player_stats rows cascade-delete with the fixture automatically (ON DELETE CASCADE).
  statements.push({ sql: "DELETE FROM fixtures WHERE id = ?", args: [id] });

  const db = await getDb();
  await db.batch(statements, "write");

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/table");
  revalidatePath("/teams");
  revalidatePath("/fixtures");
}

/**
 * Undoes a played match without deleting the fixture itself: clears the
 * score and every player's stats, reverses the win/draw/loss budget bonus,
 * and sends it back to "scheduled" so the admin can re-enter it (fixing a
 * mistaken entry, wrong game, etc.) without having to recreate the
 * matchup and gameweek from scratch.
 */
export async function markFixtureNotPlayedAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));

  const fixture = await get<{ id: number; status: string }>("SELECT id, status FROM fixtures WHERE id = ?", [id]);
  if (!fixture || fixture.status !== "final") return;

  const txns = await all<{ team_id: number; amount: number }>(
    "SELECT team_id, amount FROM transactions WHERE fixture_id = ?",
    [id]
  );

  const statements: { sql: string; args: (string | number | null)[] }[] = txns.map((t) => ({
    sql: "UPDATE teams SET budget_remaining = budget_remaining - ? WHERE id = ?",
    args: [t.amount, t.team_id],
  }));
  statements.push(
    { sql: "DELETE FROM transactions WHERE fixture_id = ?", args: [id] },
    { sql: "DELETE FROM player_stats WHERE fixture_id = ?", args: [id] },
    {
      sql: "UPDATE fixtures SET home_score = NULL, away_score = NULL, status = 'scheduled', played_at = NULL WHERE id = ?",
      args: [id],
    }
  );

  const db = await getDb();
  await db.batch(statements, "write");

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/table");
  revalidatePath("/teams");
  revalidatePath("/fixtures");
  revalidatePath(`/fixtures/${id}`);
}

interface PlayerLineInput {
  playerId: number;
  teamId: number;
  position: Position;
  played: boolean;
  goals: number;
  assists: number;
  blueCards: number;
  penaltySaves: number;
  penaltyMisses: number;
  ownGoals: number;
}

export async function submitFixtureScoreAction(formData: FormData) {
  await requireAdmin();

  const fixtureId = Number(formData.get("fixtureId"));
  const homeScore = Number(formData.get("homeScore"));
  const awayScore = Number(formData.get("awayScore"));

  const fixture = await get<{ id: number; home_team_id: number; away_team_id: number; gameweek_id: number }>(
    "SELECT * FROM fixtures WHERE id = ?",
    [fixtureId]
  );
  if (!fixture) throw new Error("Fixture not found");

  if (Number.isNaN(homeScore) || Number.isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
    throw new Error("Scores must be non-negative numbers");
  }

  const homePlayers = await getPlayersByTeam(fixture.home_team_id);
  const awayPlayers = await getPlayersByTeam(fixture.away_team_id);
  const allPlayers = [...homePlayers, ...awayPlayers];

  const lines: PlayerLineInput[] = allPlayers.map((p) => ({
    playerId: p.id,
    teamId: p.team_id!,
    position: p.position!,
    played: formData.get(`played_${p.id}`) === "on",
    goals: Math.max(0, Number(formData.get(`goals_${p.id}`)) || 0),
    assists: Math.max(0, Number(formData.get(`assists_${p.id}`)) || 0),
    blueCards: Math.max(0, Number(formData.get(`blue_${p.id}`)) || 0),
    penaltySaves: Math.max(0, Number(formData.get(`pensave_${p.id}`)) || 0),
    penaltyMisses: Math.max(0, Number(formData.get(`penmiss_${p.id}`)) || 0),
    ownGoals: Math.max(0, Number(formData.get(`owngoal_${p.id}`)) || 0),
  }));

  const homeOutcome = outcomeFor(homeScore, awayScore);
  const awayOutcome = outcomeFor(awayScore, homeScore);
  const homeBonus = RESULT_BONUS[homeOutcome];
  const awayBonus = RESULT_BONUS[awayOutcome];

  // If this fixture was already played and is being corrected, its previous
  // win/draw/loss bonus is still sitting in budget_remaining — reverse it
  // before applying the new one, or re-submitting an already-final score
  // just keeps stacking bonuses on top of each other.
  const oldTxns = await all<{ team_id: number; amount: number }>(
    "SELECT team_id, amount FROM transactions WHERE fixture_id = ?",
    [fixtureId]
  );

  const statements: { sql: string; args: (string | number)[] }[] = [
    // Clean up anything from a previous submission for this fixture so edits are idempotent.
    { sql: "DELETE FROM player_stats WHERE fixture_id = ?", args: [fixtureId] },
    { sql: "DELETE FROM transactions WHERE fixture_id = ?", args: [fixtureId] },
    ...oldTxns.map((t) => ({
      sql: "UPDATE teams SET budget_remaining = budget_remaining - ? WHERE id = ?",
      args: [t.amount, t.team_id],
    })),
  ];

  for (const line of lines) {
    const teamGoalsConceded = line.teamId === fixture.home_team_id ? awayScore : homeScore;
    const result = calculatePlayerMatchPoints({
      position: line.position,
      played: line.played,
      goals: line.goals,
      assists: line.assists,
      teamGoalsConceded,
      blueCards: line.blueCards,
      penaltySaves: line.penaltySaves,
      penaltyMisses: line.penaltyMisses,
      ownGoals: line.ownGoals,
    });
    statements.push({
      sql: `INSERT INTO player_stats (fixture_id, player_id, played, goals, assists, blue_cards, points, clean_sheet, goals_conceded, penalty_saves, penalty_misses, own_goals)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        fixtureId,
        line.playerId,
        line.played ? 1 : 0,
        line.goals,
        line.assists,
        line.blueCards,
        result.points,
        result.cleanSheet ? 1 : 0,
        teamGoalsConceded,
        line.penaltySaves,
        line.penaltyMisses,
        line.ownGoals,
      ],
    });
  }

  statements.push(
    {
      sql: "UPDATE fixtures SET home_score = ?, away_score = ?, status = 'final', played_at = datetime('now') WHERE id = ?",
      args: [homeScore, awayScore, fixtureId],
    },
    {
      sql: "INSERT INTO transactions (team_id, fixture_id, amount, reason) VALUES (?, ?, ?, ?)",
      args: [fixture.home_team_id, fixtureId, homeBonus, `Match result bonus (${homeOutcome.toLowerCase()})`],
    },
    {
      sql: "UPDATE teams SET budget_remaining = budget_remaining + ? WHERE id = ?",
      args: [homeBonus, fixture.home_team_id],
    },
    {
      sql: "INSERT INTO transactions (team_id, fixture_id, amount, reason) VALUES (?, ?, ?, ?)",
      args: [fixture.away_team_id, fixtureId, awayBonus, `Match result bonus (${awayOutcome.toLowerCase()})`],
    },
    {
      sql: "UPDATE teams SET budget_remaining = budget_remaining + ? WHERE id = ?",
      args: [awayBonus, fixture.away_team_id],
    }
  );

  const db = await getDb();
  await db.batch(statements, "write");

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/table");
  revalidatePath("/teams");
  redirect("/admin");
}

// ---------- Teams ----------

export async function updateTeamBudgetAction(formData: FormData) {
  await requireAdmin();
  const teamId = Number(formData.get("teamId"));
  const budget = Number(formData.get("budget"));
  if (Number.isNaN(budget)) throw new Error("Invalid budget");

  const db = await getDb();
  await db.batch(
    [
      { sql: "UPDATE teams SET budget_remaining = ? WHERE id = ?", args: [budget, teamId] },
      {
        sql: "INSERT INTO transactions (team_id, amount, reason) VALUES (?, 0, 'Budget manually set by admin')",
        args: [teamId],
      },
    ],
    "write"
  );

  revalidatePath("/admin");
  revalidatePath("/teams");
  revalidatePath(`/teams/${teamId}`);
}

// ---------- Admin Users ----------

export async function addAdminUserAction(formData: FormData) {
  await requireAdmin();
  const username = String(formData.get("username") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const displayName = String(formData.get("displayName") || "").trim() || null;

  if (!username || password.length < 6) {
    throw new Error("Username required and password must be at least 6 characters");
  }

  const hash = bcrypt.hashSync(password, 10);
  await run("INSERT INTO admin_users (username, password_hash, display_name) VALUES (?, ?, ?)", [
    username,
    hash,
    displayName,
  ]);

  revalidatePath("/admin/users");
}

export async function deleteAdminUserAction(formData: FormData) {
  const current = await requireAdmin();
  const id = Number(formData.get("id"));
  if (id === current.uid) throw new Error("You cannot delete your own account while logged in");
  await run("DELETE FROM admin_users WHERE id = ?", [id]);
  revalidatePath("/admin/users");
}

// ---------- Players ----------

const VALID_POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];
// Matches the real auction result: every team ended up with 1 GK, 3 DEF,
// 3 MID, 1 FWD (not the originally planned 1-3-2-2).
const POSITION_LIMITS: Record<Position, number> = { GK: 1, DEF: 3, MID: 3, FWD: 1 };

/** Throws if putting `position` on `teamId` would break the 1-3-3-1 squad shape. */
async function assertSquadSlotAvailable(teamId: number, position: Position, excludePlayerId?: number) {
  const row = excludePlayerId
    ? await get<{ c: number }>(
        "SELECT COUNT(*) as c FROM players WHERE team_id = ? AND position = ? AND id != ?",
        [teamId, position, excludePlayerId]
      )
    : await get<{ c: number }>("SELECT COUNT(*) as c FROM players WHERE team_id = ? AND position = ?", [
        teamId,
        position,
      ]);
  if (Number(row?.c ?? 0) >= POSITION_LIMITS[position]) {
    throw new Error(
      `That team already has ${POSITION_LIMITS[position]} ${position} player(s) — the squad shape is 1 GK, 3 DEF, 3 MID, 1 FWD.`
    );
  }
}

export async function addPlayerAction(formData: FormData) {
  await requireAdmin();
  const teamId = Number(formData.get("teamId"));
  const name = String(formData.get("name") || "").trim();
  const position = String(formData.get("position") || "").toUpperCase() as Position;
  const price = Number(formData.get("price")) || 0;
  const lastSeasonPoints = Number(formData.get("lastSeasonPoints")) || 0;

  if (!teamId || !name) throw new Error("Missing team or player name");
  if (!VALID_POSITIONS.includes(position)) throw new Error("Invalid position");
  await assertSquadSlotAvailable(teamId, position);

  await run("INSERT INTO players (team_id, name, position, price, last_season_points) VALUES (?, ?, ?, ?, ?)", [
    teamId,
    name,
    position,
    price,
    lastSeasonPoints,
  ]);

  revalidatePath("/admin");
  revalidatePath("/teams");
}

/** Drafts a pool player (or re-drafts an existing one) onto a team with a position and auction price. */
export async function assignPlayerAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const teamId = Number(formData.get("teamId"));
  const position = String(formData.get("position") || "").toUpperCase() as Position;
  const price = Number(formData.get("price")) || 0;

  if (!id || !teamId) throw new Error("Missing player or team");
  if (!VALID_POSITIONS.includes(position)) throw new Error("Invalid position");
  await assertSquadSlotAvailable(teamId, position, id);

  await run("UPDATE players SET team_id = ?, position = ?, price = ? WHERE id = ?", [
    teamId,
    position,
    price,
    id,
  ]);

  revalidatePath("/admin");
  revalidatePath("/teams");
  revalidatePath(`/players/${id}`);
}

export async function unassignPlayerAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await run("UPDATE players SET team_id = NULL, position = NULL, price = 0 WHERE id = ?", [id]);
  revalidatePath("/admin");
  revalidatePath("/teams");
}

export async function updatePlayerAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const position = String(formData.get("position") || "").toUpperCase() as Position;
  const price = Number(formData.get("price")) || 0;
  const lastSeasonPoints = Number(formData.get("lastSeasonPoints")) || 0;

  if (!VALID_POSITIONS.includes(position)) throw new Error("Invalid position");

  const current = await get<{ team_id: number | null; position: Position | null }>(
    "SELECT team_id, position FROM players WHERE id = ?",
    [id]
  );
  if (current?.team_id && position !== current.position) {
    await assertSquadSlotAvailable(current.team_id, position, id);
  }

  await run("UPDATE players SET name = ?, position = ?, price = ?, last_season_points = ? WHERE id = ?", [
    name,
    position,
    price,
    lastSeasonPoints,
    id,
  ]);

  revalidatePath("/admin");
  revalidatePath("/teams");
  revalidatePath(`/players/${id}`);
}

export async function deletePlayerAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await run("DELETE FROM players WHERE id = ?", [id]);
  revalidatePath("/admin");
  revalidatePath("/teams");
}

function normalizePosition(raw: string): Position | null {
  const v = raw.trim().toUpperCase();
  if (["GK", "GOALKEEPER", "GOALIE"].includes(v)) return "GK";
  if (["DEF", "DEFENDER", "DEFENCE", "DEFENSE"].includes(v)) return "DEF";
  if (["MID", "MIDFIELDER", "MIDFIELD"].includes(v)) return "MID";
  if (["FWD", "FORWARD", "STRIKER", "ST", "ATT", "ATTACKER"].includes(v)) return "FWD";
  return null;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export async function importPlayersCsvAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No CSV file provided");

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("CSV is empty");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    team: header.indexOf("team"),
    name: header.indexOf("name"),
    position: header.indexOf("position"),
    price: header.indexOf("price"),
    lastSeason: header.findIndex((h) => h.includes("last_season") || h.includes("last season")),
  };
  if (idx.team === -1 || idx.name === -1 || idx.position === -1) {
    throw new Error("CSV must have at least: team, name, position columns");
  }

  const teams = await all<{ id: number; name: string }>("SELECT id, name FROM teams");
  const teamByName = new Map(teams.map((t) => [t.name.trim().toLowerCase(), t.id]));

  const statements: { sql: string; args: (string | number)[] }[] = [];
  for (const cols of rows.slice(1)) {
    const teamName = (cols[idx.team] || "").trim();
    const name = (cols[idx.name] || "").trim();
    const posRaw = (cols[idx.position] || "").trim();
    if (!teamName || !name || !posRaw) continue;

    const teamId = teamByName.get(teamName.toLowerCase());
    const position = normalizePosition(posRaw);
    if (!teamId || !position) continue;

    const price = idx.price >= 0 ? Number(cols[idx.price]) || 0 : 0;
    const lastSeason = idx.lastSeason >= 0 ? Number(cols[idx.lastSeason]) || 0 : 0;

    statements.push({
      sql: "INSERT INTO players (team_id, name, position, price, last_season_points) VALUES (?, ?, ?, ?, ?)",
      args: [teamId, name, position, price, lastSeason],
    });
  }

  if (statements.length > 0) {
    const db = await getDb();
    await db.batch(statements, "write");
  }

  revalidatePath("/admin");
  revalidatePath("/teams");
}
