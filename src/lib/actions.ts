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

interface PlayerLineInput {
  playerId: number;
  teamId: number;
  position: Position;
  played: boolean;
  goals: number;
  assists: number;
  blueCards: number;
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
  }));

  const homeOutcome = outcomeFor(homeScore, awayScore);
  const awayOutcome = outcomeFor(awayScore, homeScore);
  const homeBonus = RESULT_BONUS[homeOutcome];
  const awayBonus = RESULT_BONUS[awayOutcome];

  const statements: { sql: string; args: (string | number)[] }[] = [
    // Clean up anything from a previous submission for this fixture so edits are idempotent.
    { sql: "DELETE FROM player_stats WHERE fixture_id = ?", args: [fixtureId] },
    { sql: "DELETE FROM transactions WHERE fixture_id = ?", args: [fixtureId] },
  ];

  for (const line of lines) {
    const teamGoalsConceded = line.teamId === fixture.home_team_id ? awayScore : homeScore;
    const result = calculatePlayerMatchPoints({
      position: line.position,
      played: line.played,
      goals: line.goals,
      assists: line.assists,
      teamGoalsConceded,
    });
    statements.push({
      sql: `INSERT INTO player_stats (fixture_id, player_id, played, goals, assists, blue_cards, points, clean_sheet, goals_conceded)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
const POSITION_LIMITS: Record<Position, number> = { GK: 1, DEF: 3, MID: 2, FWD: 2 };

/** Throws if putting `position` on `teamId` would break the 1-3-2-2 squad shape. */
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
      `That team already has ${POSITION_LIMITS[position]} ${position} player(s) — the squad shape is 1 GK, 3 DEF, 2 MID, 2 FWD.`
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

// The final confirmed registration list ahead of the auction: every
// returning player's locked-in position for the season (captains included).
// Team assignment for everyone except captains is decided at auction, so
// this resets non-captains back to the pool rather than guessing a team.
const FINAL_SQUAD_POSITIONS: Record<string, Position> = {
  "Samin Haque": "FWD",
  "Sabit Khan": "MID",
  "Arafatul Mamur": "DEF",
  "Riyad Zaman": "DEF",
  "Masrur Rahman": "GK",
  "Jawad Anis": "GK",
  "Rayhan Hussain": "GK",
  "Rizvi Ibrahim": "DEF",
  "Farhan Labib": "DEF",
  "Rahmat Ullah": "DEF",
  "Azmi Hoque": "DEF",
  "Hasnan Siddique Sunve": "DEF",
  "Mubashir Rahman": "DEF",
  "Rishik Roy": "DEF",
  "K M Chisty": "DEF",
  "Md Rafiu Hossain": "DEF",
  "Aafeef Kabir": "DEF",
  "Mirza Mohammed": "MID",
  "Faiad Rehman": "MID",
  "Aiman Nawar Chowdhury": "MID",
  "Shahriar Anwar Khan": "MID",
  "Fairooz Abir": "MID",
  "Taqi Rahman": "MID",
  "Tahsin Islam": "FWD",
  "Munem Morshed": "FWD",
  "Ishmam Rahman": "FWD",
  "Hussain Yeasin": "FWD",
  "Hasan Mahtab": "FWD",
  "Adeeb Ahmed": "FWD",
  "Navid Rahman": "FWD",
};

const CAPTAIN_TEAMS: Record<string, string> = {
  "Samin Haque": "Blackouts FC",
  "Sabit Khan": "Darkstar FC",
  "Arafatul Mamur": "Goli Underdogs",
  "Riyad Zaman": "Showstoppers",
};

// New registrants not in the original list, placed on a team now per admin
// request — the real auction will set their final team and price.
const NEW_PLAYERS: { name: string; position: Position; team: string }[] = [
  { name: "Nabil Shahriar", position: "GK", team: "Blackouts FC" },
  { name: "Shadman Sakib", position: "MID", team: "Darkstar FC" },
];

// Not in the league this season — replaced by the new registrants above:
// Nabil Shahriar plays in Mahfuz Haque's place, Shadman Sakib in Sajid
// Khalid's. (These same replacements also run automatically on every
// server start via reconcileRosterChanges in db.ts, so this sync button
// isn't the only thing that applies them.)
const PLAYERS_TO_REMOVE = ["Mahfuz Haque", "Sajid Khalid"];

/**
 * One-time sync to the confirmed final squad list: removes players who
 * dropped out, adds new registrants, sets everyone's locked-in position for
 * the season, and sends every non-captain back to the undrafted pool ready
 * for the real auction (undoing the earlier placeholder auto-draft). Safe
 * to re-run.
 */
export async function syncFinalSquadAction() {
  await requireAdmin();
  const db = await getDb();

  const teams = await all<{ id: number; name: string }>("SELECT id, name FROM teams");
  const teamIdByName = new Map(teams.map((t) => [t.name, t.id]));

  const statements: { sql: string; args: (string | number | null)[] }[] = [];

  for (const name of PLAYERS_TO_REMOVE) {
    statements.push({ sql: "DELETE FROM players WHERE name = ?", args: [name] });
  }

  for (const [name, position] of Object.entries(FINAL_SQUAD_POSITIONS)) {
    const captainTeam = CAPTAIN_TEAMS[name];
    const teamId = captainTeam ? teamIdByName.get(captainTeam) ?? null : null;
    statements.push({
      sql: "UPDATE players SET position = ?, team_id = ?, is_captain = ?, price = 0 WHERE name = ?",
      args: [position, teamId, captainTeam ? 1 : 0, name],
    });
  }

  await db.batch(statements, "write");

  const existing = await all<{ name: string }>(
    `SELECT name FROM players WHERE name IN (${NEW_PLAYERS.map(() => "?").join(",")})`,
    NEW_PLAYERS.map((p) => p.name)
  );
  const existingNames = new Set(existing.map((r) => r.name));

  const inserts = NEW_PLAYERS.filter((p) => !existingNames.has(p.name)).map((p) => ({
    sql: "INSERT INTO players (team_id, name, position, price, last_season_points, is_captain) VALUES (?, ?, ?, 0, 0, 0)",
    args: [teamIdByName.get(p.team) ?? null, p.name, p.position] as (string | number | null)[],
  }));
  if (inserts.length > 0) await db.batch(inserts, "write");

  revalidatePath("/admin");
  revalidatePath("/admin/players");
  revalidatePath("/teams");
  revalidatePath("/table");
  revalidatePath("/");
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
