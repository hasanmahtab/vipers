import { createClient, type Client, type InArgs } from "@libsql/client";
import bcrypt from "bcryptjs";
import { calculatePlayerMatchPoints, type Position } from "./scoring";

declare global {
  // eslint-disable-next-line no-var
  var __vipersDb: Client | undefined;
  // eslint-disable-next-line no-var
  var __vipersDbReady: Promise<void> | undefined;
}

function createConnection(): Client {
  // Turso (or any libSQL server) in production: set TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.
  // Falls back to a local file for local development only — that file does NOT
  // survive on hosts without a persistent disk (e.g. Render's free tier), so
  // production deployments should always point at a real Turso database.
  const url = process.env.TURSO_DATABASE_URL || `file:${process.env.DB_PATH || "./data/vipers.db"}`;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return createClient({ url, authToken });
}

function getClient(): Client {
  if (!global.__vipersDb) {
    global.__vipersDb = createConnection();
  }
  return global.__vipersDb;
}

/** Always await this before touching the database — it lazily runs migrations + seeding once. */
export async function getDb(): Promise<Client> {
  const client = getClient();
  if (!global.__vipersDbReady) {
    global.__vipersDbReady = migrate(client).catch((err) => {
      global.__vipersDbReady = undefined;
      throw err;
    });
  }
  await global.__vipersDbReady;
  return client;
}

export async function run(sql: string, args: InArgs = []) {
  const db = await getDb();
  return db.execute({ sql, args });
}

export async function get<T = any>(sql: string, args: InArgs = []): Promise<T | undefined> {
  const db = await getDb();
  const result = await db.execute({ sql, args });
  return (result.rows[0] as unknown as T) ?? undefined;
}

export async function all<T = any>(sql: string, args: InArgs = []): Promise<T[]> {
  const db = await getDb();
  const result = await db.execute({ sql, args });
  return result.rows as unknown as T[];
}

async function migrate(db: Client) {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      captain TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#39ff14',
      budget_remaining REAL NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      position TEXT CHECK (position IS NULL OR position IN ('GK','DEF','MID','FWD')),
      price REAL NOT NULL DEFAULT 0,
      last_season_points INTEGER NOT NULL DEFAULT 0,
      is_captain INTEGER NOT NULL DEFAULT 0,
      photo_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gameweeks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL UNIQUE,
      label TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','completed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fixtures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gameweek_id INTEGER NOT NULL REFERENCES gameweeks(id) ON DELETE CASCADE,
      home_team_id INTEGER NOT NULL REFERENCES teams(id),
      away_team_id INTEGER NOT NULL REFERENCES teams(id),
      home_score INTEGER,
      away_score INTEGER,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','final')),
      played_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS player_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      played INTEGER NOT NULL DEFAULT 0,
      goals INTEGER NOT NULL DEFAULT 0,
      assists INTEGER NOT NULL DEFAULT 0,
      blue_cards INTEGER NOT NULL DEFAULT 0,
      points REAL NOT NULL DEFAULT 0,
      clean_sheet INTEGER NOT NULL DEFAULT 0,
      goals_conceded INTEGER NOT NULL DEFAULT 0,
      penalty_saves INTEGER NOT NULL DEFAULT 0,
      penalty_misses INTEGER NOT NULL DEFAULT 0,
      own_goals INTEGER NOT NULL DEFAULT 0,
      UNIQUE(fixture_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      fixture_id INTEGER REFERENCES fixtures(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- One-off data migrations (bulk imports, corrections) that must run
    -- exactly once, automatically, on server start — see applyOnce below.
    CREATE TABLE IF NOT EXISTS applied_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
    CREATE INDEX IF NOT EXISTS idx_fixtures_gameweek ON fixtures(gameweek_id);
    CREATE INDEX IF NOT EXISTS idx_stats_fixture ON player_stats(fixture_id);
    CREATE INDEX IF NOT EXISTS idx_stats_player ON player_stats(player_id);
    CREATE INDEX IF NOT EXISTS idx_tx_team ON transactions(team_id);
  `);

  // CREATE TABLE IF NOT EXISTS above only shapes a brand-new table — an
  // existing database (i.e. production) needs these columns added by hand.
  await ensureColumns(db, "player_stats", {
    penalty_saves: "INTEGER NOT NULL DEFAULT 0",
    penalty_misses: "INTEGER NOT NULL DEFAULT 0",
    own_goals: "INTEGER NOT NULL DEFAULT 0",
  });

  await seedIfEmpty(db);
  await reconcileRosterChanges(db);
  await applyOnce(db, "final_auction_results_v1", applyFinalAuctionResults);
  await ensureCaptainsPresent(db);
  await ensureLastSeasonPointsCorrect(db);
  await applyOnce(db, "recalculate_points_v1", recalculateHistoricalPoints);
  await applyOnce(db, "fix_budget_double_counting_v1", fixBudgetDoubleCounting);
  // Appearance points changed again after week 1 (1 -> 2) — same recompute,
  // re-run under a new name since v1 already used up its one shot.
  await applyOnce(db, "recalculate_points_v2", recalculateHistoricalPoints);
}

// The point values changed (appearance 2->1, GK/DEF clean sheet 5->4) and
// blue cards were being recorded but never actually deducted from points —
// so every already-played match's points need recomputing under the
// corrected rules, not just future ones. One-time: after this, every new
// score submission already uses calculatePlayerMatchPoints directly.
async function recalculateHistoricalPoints(db: Client) {
  const rows = await db.execute(`
    SELECT ps.id, ps.played, ps.goals, ps.assists, ps.blue_cards, ps.goals_conceded,
           ps.penalty_saves, ps.penalty_misses, ps.own_goals, pl.position
    FROM player_stats ps
    JOIN players pl ON pl.id = ps.player_id
  `);

  const statements = rows.rows
    .filter((r) => r.position != null)
    .map((r) => {
      const result = calculatePlayerMatchPoints({
        position: r.position as unknown as Position,
        played: (r.played as unknown as number) === 1,
        goals: r.goals as unknown as number,
        assists: r.assists as unknown as number,
        teamGoalsConceded: r.goals_conceded as unknown as number,
        blueCards: r.blue_cards as unknown as number,
        penaltySaves: r.penalty_saves as unknown as number,
        penaltyMisses: r.penalty_misses as unknown as number,
        ownGoals: r.own_goals as unknown as number,
      });
      return {
        sql: "UPDATE player_stats SET points = ? WHERE id = ?",
        args: [result.points, r.id as unknown as number],
      };
    });

  if (statements.length > 0) await db.batch(statements, "write");
}

/** Adds any of `columns` not already on `table`, safe to re-run every boot. */
async function ensureColumns(db: Client, table: string, columns: Record<string, string>) {
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const existing = new Set(info.rows.map((r) => r.name as unknown as string));
  for (const [column, definition] of Object.entries(columns)) {
    if (!existing.has(column)) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

/**
 * Runs `fn` once, ever, the first time this name is seen, then records it
 * in applied_migrations so later server starts skip it — unlike
 * reconcileRosterChanges above, this is for one-off bulk data imports that
 * shouldn't keep re-overwriting fields an admin may hand-edit afterward.
 */
async function applyOnce(db: Client, name: string, fn: (db: Client) => Promise<void>) {
  const done = await db.execute({ sql: "SELECT 1 FROM applied_migrations WHERE name = ?", args: [name] });
  if (done.rows.length > 0) return;
  await fn(db);
  await db.execute({ sql: "INSERT INTO applied_migrations (name) VALUES (?)", args: [name] });
}

// Players who dropped out of the league and who they were replaced by.
// Runs on every server start (not just when an admin clicks "Sync Final
// Squad") so a roster correction always takes effect the moment a deploy
// goes out, regardless of whether the sync button gets clicked. Every
// entry is idempotent and safe to re-run indefinitely.
const ROSTER_REPLACEMENTS: Array<{
  outName: string;
  inName: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  team: string;
}> = [
  { outName: "Sajid Khalid", inName: "Shadman Sakib", position: "MID", team: "Darkstar FC" },
  { outName: "Mahfuz Haque", inName: "Nabil Shahriar", position: "GK", team: "Blackouts FC" },
];

async function reconcileRosterChanges(db: Client) {
  for (const { outName, inName, position, team } of ROSTER_REPLACEMENTS) {
    const dropped = await db.execute({ sql: "SELECT id FROM players WHERE name = ?", args: [outName] });
    if (dropped.rows.length > 0) {
      const id = dropped.rows[0].id as unknown as number;
      await db.batch(
        [
          { sql: "DELETE FROM player_stats WHERE player_id = ?", args: [id] },
          { sql: "DELETE FROM players WHERE id = ?", args: [id] },
        ],
        "write"
      );
    }

    const replacement = await db.execute({ sql: "SELECT id FROM players WHERE name = ?", args: [inName] });
    if (replacement.rows.length === 0) {
      const teamRow = await db.execute({ sql: "SELECT id FROM teams WHERE name = ?", args: [team] });
      const teamId = (teamRow.rows[0]?.id as unknown as number) ?? null;
      await db.execute({
        sql: "INSERT INTO players (team_id, name, position, price, last_season_points, is_captain) VALUES (?, ?, ?, 0, 0, 0)",
        args: [teamId, inName, position],
      });
    }
  }
}

// A handful of names in the final auction-results CSV were spelling
// corrections of players already in the system (confirmed by matching
// every CSV row 1:1 against the existing roster with no gaps before this
// was written) — renamed here first so FINAL_ROSTER below can key off the
// corrected spelling everywhere, including the player-photo lookup map.
const NAME_CORRECTIONS: Record<string, string> = {
  "Md Rafiu Hossain": "Rafiu Hossain",
  "Hasnan Siddique Sunve": "Hasnan Sunve",
  "Rayhan Hussain": "Rayhan Hossain",
  "Rishik Roy": "Rhishik Roy",
  "Rizvi Ibrahim": "Rizvi Mahmud",
};

// The real auction result, from the league's final roster CSV: every
// player's team, position, and price. Captains aren't auctioned (price 0).
const FINAL_ROSTER: Array<{
  name: string;
  team: string;
  price: number;
  position: "GK" | "DEF" | "MID" | "FWD";
  captain?: boolean;
  lastSeasonPoints?: number;
}> = [
  { name: "Mirza Mohammed", team: "Showstoppers", price: 22, position: "MID" },
  { name: "Taqi Rahman", team: "Goli Underdogs", price: 2, position: "MID" },
  { name: "K M Chisty", team: "Showstoppers", price: 6, position: "DEF" },
  { name: "Farhan Labib", team: "Blackouts FC", price: 20, position: "DEF" },
  { name: "Rahmat Ullah", team: "Goli Underdogs", price: 17, position: "MID" },
  { name: "Shadman Sakib", team: "Darkstar FC", price: 6, position: "FWD" },
  { name: "Masrur Rahman", team: "Blackouts FC", price: 20, position: "GK" },
  { name: "Adeeb Ahmed", team: "Darkstar FC", price: 9, position: "MID" },
  { name: "Navid Rahman", team: "Darkstar FC", price: 17, position: "MID" },
  { name: "Jawad Anis", team: "Goli Underdogs", price: 19, position: "GK" },
  { name: "Rafiu Hossain", team: "Goli Underdogs", price: 2, position: "DEF" },
  { name: "Hasnan Sunve", team: "Showstoppers", price: 5, position: "DEF" },
  { name: "Shahriar Anwar Khan", team: "Showstoppers", price: 4, position: "MID" },
  { name: "Aiman Nawar Chowdhury", team: "Showstoppers", price: 6, position: "MID" },
  { name: "Rayhan Hossain", team: "Darkstar FC", price: 18, position: "GK" },
  { name: "Aafeef Kabir", team: "Goli Underdogs", price: 2, position: "MID" },
  { name: "Nabil Shahriar", team: "Showstoppers", price: 4, position: "GK" },
  { name: "Munem Morshed", team: "Blackouts FC", price: 36, position: "MID" },
  { name: "Hasan Mahtab", team: "Blackouts FC", price: 4, position: "FWD" },
  { name: "Hussain Yeasin", team: "Darkstar FC", price: 4, position: "MID" },
  { name: "Rizvi Mahmud", team: "Goli Underdogs", price: 54, position: "DEF" },
  { name: "Ishmam Rahman", team: "Darkstar FC", price: 9, position: "DEF" },
  { name: "Tahsin Islam", team: "Showstoppers", price: 37, position: "FWD" },
  { name: "Rhishik Roy", team: "Blackouts FC", price: 2, position: "MID" },
  { name: "Mubashir Rahman", team: "Goli Underdogs", price: 2, position: "FWD" },
  { name: "Faiad Rehman", team: "Darkstar FC", price: 17, position: "DEF" },
  { name: "Fairooz Abir", team: "Blackouts FC", price: 4, position: "MID" },
  { name: "Azmi Hoque", team: "Blackouts FC", price: 4, position: "DEF" },
  { name: "Samin Haque", team: "Blackouts FC", price: 0, position: "DEF", captain: true, lastSeasonPoints: 80 },
  { name: "Riyad Zaman", team: "Showstoppers", price: 0, position: "DEF", captain: true, lastSeasonPoints: 62 },
  { name: "Sabit Khan", team: "Darkstar FC", price: 0, position: "DEF", captain: true, lastSeasonPoints: 47 },
  { name: "Arafatul Mamur", team: "Goli Underdogs", price: 0, position: "DEF", captain: true, lastSeasonPoints: 42 },
];

// Each team's auction spend: 100M minus what they actually paid for
// non-captain players (captains are free) gives their post-auction budget.
function getAuctionSpendByTeam(): Map<string, number> {
  const spendByTeam = new Map<string, number>();
  for (const p of FINAL_ROSTER) {
    if (p.captain) continue;
    spendByTeam.set(p.team, (spendByTeam.get(p.team) ?? 0) + p.price);
  }
  return spendByTeam;
}

async function applyFinalAuctionResults(db: Client) {
  for (const [oldName, newName] of Object.entries(NAME_CORRECTIONS)) {
    await db.execute({ sql: "UPDATE players SET name = ? WHERE name = ?", args: [newName, oldName] });
  }

  const teams = await db.execute("SELECT id, name FROM teams");
  const teamIdByName = new Map(teams.rows.map((t) => [t.name as unknown as string, t.id as unknown as number]));

  const statements = FINAL_ROSTER.map((p) => ({
    sql: "UPDATE players SET team_id = ?, position = ?, price = ?, is_captain = ? WHERE name = ?",
    args: [teamIdByName.get(p.team) ?? null, p.position, p.price, p.captain ? 1 : 0, p.name],
  }));
  await db.batch(statements, "write");

  const spendByTeam = getAuctionSpendByTeam();
  const budgetStatements = Array.from(spendByTeam.entries()).flatMap(([team, spend]) => {
    const teamId = teamIdByName.get(team);
    if (teamId == null) return [];
    return [
      { sql: "UPDATE teams SET budget_remaining = ? WHERE id = ?", args: [100 - spend, teamId] },
      {
        sql: "INSERT INTO transactions (team_id, amount, reason) VALUES (?, 0, 'Final auction results applied')",
        args: [teamId],
      },
    ];
  });
  await db.batch(budgetStatements, "write");
}

// submitFixtureScoreAction used to add a fixture's win/draw/loss bonus to
// budget_remaining on every submission without reversing the previous
// bonus first, so re-submitting (correcting) an already-played fixture's
// score silently stacked bonuses on top of each other. The transactions
// table itself was never corrupted by this (each fixture always holds at
// most one current transaction row per team, replaced on every
// resubmission) — only budget_remaining drifted. Recompute it from
// scratch: 100M minus auction spend, plus every transaction actually on
// the books now. Skips any team that has ever had its budget manually set
// via "Manage Budgets", since that's a deliberate admin override this
// formula can't account for.
async function fixBudgetDoubleCounting(db: Client) {
  const teams = await db.execute("SELECT id, name FROM teams");
  const spendByTeam = getAuctionSpendByTeam();

  for (const row of teams.rows) {
    const teamId = row.id as unknown as number;
    const teamName = row.name as unknown as string;

    const manualOverride = await db.execute({
      sql: "SELECT 1 FROM transactions WHERE team_id = ? AND reason = 'Budget manually set by admin' LIMIT 1",
      args: [teamId],
    });
    if (manualOverride.rows.length > 0) continue;

    const sumRow = await db.execute({
      sql: "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE team_id = ?",
      args: [teamId],
    });
    const spend = spendByTeam.get(teamName) ?? 0;
    const correctBudget = 100 - spend + Number(sumRow.rows[0].total);
    await db.execute({ sql: "UPDATE teams SET budget_remaining = ? WHERE id = ?", args: [correctBudget, teamId] });
  }
}

// Captains own their team and must always exist. If one is ever deleted
// (e.g. an accidental click on the admin players page), restore them with
// their known team/position on every server start — cheap to check, and
// a no-op once they're back, so this runs unconditionally every boot
// rather than once like applyFinalAuctionResults above.
async function ensureCaptainsPresent(db: Client) {
  for (const captain of FINAL_ROSTER.filter((p) => p.captain)) {
    const lastSeasonPoints = captain.lastSeasonPoints ?? 0;
    const existing = await db.execute({
      sql: "SELECT id, last_season_points FROM players WHERE name = ?",
      args: [captain.name],
    });
    if (existing.rows.length > 0) {
      // Already restored once before this fix, with last_season_points
      // wrongly defaulted to 0 — top it up now that we know the real value.
      if (Number(existing.rows[0].last_season_points) === 0 && lastSeasonPoints > 0) {
        await db.execute({
          sql: "UPDATE players SET last_season_points = ? WHERE id = ?",
          args: [lastSeasonPoints, existing.rows[0].id as unknown as number],
        });
      }
      continue;
    }
    const teamRow = await db.execute({ sql: "SELECT id FROM teams WHERE name = ?", args: [captain.team] });
    const teamId = (teamRow.rows[0]?.id as unknown as number) ?? null;
    await db.execute({
      sql: "INSERT INTO players (team_id, name, position, price, last_season_points, is_captain) VALUES (?, ?, ?, 0, ?, 1)",
      args: [teamId, captain.name, captain.position, lastSeasonPoints],
    });
  }
}

// Fix any player whose last_season_points got reset to 0 when it
// shouldn't be — e.g. Hasan Mahtab, who should show 74 (his real value
// from RAW_PLAYER_POOL below) but ended up at 0, most likely from being
// deleted and re-added via "Add a New Player Directly" without
// re-entering that field. Runs on every boot; only ever moves a 0 to the
// known correct value, never touches a player already showing something
// else (that could be a legitimate admin edit, not damage to repair).
async function ensureLastSeasonPointsCorrect(db: Client) {
  const known = new Map<string, number>();
  for (const [rawName, points] of RAW_PLAYER_POOL) {
    if (points === 0) continue;
    const cleanName = titleCase(rawName.replace(/\(c\)\s*$/i, "").trim());
    known.set(NAME_CORRECTIONS[cleanName] ?? cleanName, points);
  }
  for (const captain of FINAL_ROSTER.filter((p) => p.captain)) {
    if (captain.lastSeasonPoints) known.set(captain.name, captain.lastSeasonPoints);
  }

  for (const [name, points] of known) {
    await db.execute({
      sql: "UPDATE players SET last_season_points = ? WHERE name = ? AND last_season_points = 0",
      args: [points, name],
    });
  }
}

const DEFAULT_TEAMS: Array<{ name: string; captain: string; color: string }> = [
  { name: "Blackouts FC", captain: "Samin Haque", color: "#39ff14" },
  { name: "Darkstar FC", captain: "Sabit Khan", color: "#ff2e3b" },
  { name: "Showstoppers", captain: "Riyad Zaman", color: "#f5d90a" },
  { name: "Goli Underdogs", captain: "Arafatul Mamur", color: "#2ea0ff" },
];

// The full pool of 32 registered players and their final points from last
// season, supplied ahead of the auction. They start with no team, no
// position and no price — the admin drafts each one onto a team (setting
// their position and auction price) from /admin/players once the auction
// happens.
const RAW_PLAYER_POOL: Array<[string, number]> = [
  ["Samin Haque (C)", 80],
  ["Rahmat Ullah", 83],
  ["Sabit Khan (C)", 47],
  ["Shahriar Anwar Khan", 70],
  ["K M Chisty", 55],
  ["Hussain Yeasin", 0],
  ["Ishmam Rahman", 65],
  ["Md Rafiu Hossain", 50],
  ["Hasan Mahtab", 74],
  ["Munem Morshed", 0],
  ["Mahfuz Haque", 0],
  ["Adeeb ahmed", 70],
  ["Masrur Rahman", 0],
  ["Arafatul Mamur (C)", 42],
  ["Aafeef Kabir", 54],
  ["Aiman Nawar Chowdhury", 57],
  ["Sajid Khalid", 0],
  ["Rayhan Hussain", 0],
  ["navid rahman", 88],
  ["Rizvi Ibrahim", 111],
  ["Fairooz Abir", 76],
  ["Riyad Zaman (C)", 62],
  ["Faiad Rehman", 74],
  ["Mirza Mohammed", 0],
  ["Azmi Hoque", 64],
  ["Mubashir Rahman", 57],
  ["Farhan Labib", 0],
  ["Jawad Anis", 0],
  ["Taqi Rahman", 37],
  ["Hasnan Siddique Sunve", 0],
  ["Rishik Roy", 62],
  ["Tahsin Islam", 0],
];

function titleCase(name: string): string {
  return name
    .split(" ")
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

async function count(db: Client, table: string): Promise<number> {
  const result = await db.execute(`SELECT COUNT(*) as c FROM ${table}`);
  return Number(result.rows[0].c as unknown as number);
}

async function seedIfEmpty(db: Client) {
  if ((await count(db, "teams")) === 0) {
    await db.batch(
      DEFAULT_TEAMS.map((t) => ({
        sql: "INSERT INTO teams (name, captain, color, budget_remaining) VALUES (?, ?, ?, 100)",
        args: [t.name, t.captain, t.color],
      })),
      "write"
    );
  }

  if ((await count(db, "players")) === 0) {
    await db.batch(
      RAW_PLAYER_POOL.map(([rawName, points]) => {
        const isCaptain = /\(c\)\s*$/i.test(rawName.trim());
        const cleanName = titleCase(rawName.replace(/\(c\)\s*$/i, "").trim());
        return {
          sql: "INSERT INTO players (team_id, name, position, price, last_season_points, is_captain) VALUES (NULL, ?, NULL, 0, ?, ?)",
          args: [cleanName, points, isCaptain ? 1 : 0],
        };
      }),
      "write"
    );
  }

  if ((await count(db, "admin_users")) === 0) {
    const password = process.env.ADMIN_PASSWORD || "change-me-please";
    const hash = bcrypt.hashSync(password, 10);
    await db.execute({
      sql: "INSERT INTO admin_users (username, password_hash, display_name) VALUES (?, ?, ?)",
      args: ["admin", hash, "League Admin"],
    });
  }

  if ((await count(db, "gameweeks")) === 0) {
    await db.execute("INSERT INTO gameweeks (number, label, status) VALUES (1, 'Gameweek 1', 'active')");
  }
}
