import { createClient, type Client, type InArgs } from "@libsql/client";
import bcrypt from "bcryptjs";

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

    CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
    CREATE INDEX IF NOT EXISTS idx_fixtures_gameweek ON fixtures(gameweek_id);
    CREATE INDEX IF NOT EXISTS idx_stats_fixture ON player_stats(fixture_id);
    CREATE INDEX IF NOT EXISTS idx_stats_player ON player_stats(player_id);
    CREATE INDEX IF NOT EXISTS idx_tx_team ON transactions(team_id);
  `);

  await seedIfEmpty(db);
  await reconcileRosterChanges(db);
}

// Sajid Khalid dropped out of the league; Shadman Sakib plays in his place
// on Darkstar FC. Runs on every server start (not just when an admin clicks
// "Sync Final Squad") so this correction always takes effect the moment a
// deploy goes out, regardless of whether the sync button gets clicked.
// Both halves are idempotent and safe to re-run indefinitely.
async function reconcileRosterChanges(db: Client) {
  const sajid = await db.execute({
    sql: "SELECT id FROM players WHERE name = ?",
    args: ["Sajid Khalid"],
  });
  if (sajid.rows.length > 0) {
    const id = sajid.rows[0].id as unknown as number;
    await db.batch(
      [
        { sql: "DELETE FROM player_stats WHERE player_id = ?", args: [id] },
        { sql: "DELETE FROM players WHERE id = ?", args: [id] },
      ],
      "write"
    );
  }

  const shadman = await db.execute({
    sql: "SELECT id FROM players WHERE name = ?",
    args: ["Shadman Sakib"],
  });
  if (shadman.rows.length === 0) {
    const darkstar = await db.execute({
      sql: "SELECT id FROM teams WHERE name = ?",
      args: ["Darkstar FC"],
    });
    const teamId = (darkstar.rows[0]?.id as unknown as number) ?? null;
    await db.execute({
      sql: "INSERT INTO players (team_id, name, position, price, last_season_points, is_captain) VALUES (?, 'Shadman Sakib', 'MID', 0, 0, 0)",
      args: [teamId],
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
