import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const DB_PATH = process.env.DB_PATH || "./data/vipers.db";

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

declare global {
  // eslint-disable-next-line no-var
  var __vipersDb: Database.Database | undefined;
}

function createConnection(): Database.Database {
  ensureDir(DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function getDb(): Database.Database {
  if (!global.__vipersDb) {
    global.__vipersDb = createConnection();
  }
  return global.__vipersDb;
}

function migrate(db: Database.Database) {
  db.exec(`
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

  seedIfEmpty(db);
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

function seedIfEmpty(db: Database.Database) {
  const teamCount = (db.prepare("SELECT COUNT(*) as c FROM teams").get() as { c: number }).c;
  if (teamCount === 0) {
    const insert = db.prepare(
      "INSERT INTO teams (name, captain, color, budget_remaining) VALUES (?, ?, ?, 100)"
    );
    const insertMany = db.transaction((teams: typeof DEFAULT_TEAMS) => {
      for (const t of teams) insert.run(t.name, t.captain, t.color);
    });
    insertMany(DEFAULT_TEAMS);
  }

  const playerCount = (db.prepare("SELECT COUNT(*) as c FROM players").get() as { c: number }).c;
  if (playerCount === 0) {
    const insert = db.prepare(
      "INSERT INTO players (team_id, name, position, price, last_season_points, is_captain) VALUES (NULL, ?, NULL, 0, ?, ?)"
    );
    const insertMany = db.transaction((pool: typeof RAW_PLAYER_POOL) => {
      for (const [rawName, points] of pool) {
        const isCaptain = /\(c\)\s*$/i.test(rawName.trim());
        const cleanName = titleCase(rawName.replace(/\(c\)\s*$/i, "").trim());
        insert.run(cleanName, points, isCaptain ? 1 : 0);
      }
    });
    insertMany(RAW_PLAYER_POOL);
  }

  const adminCount = (db.prepare("SELECT COUNT(*) as c FROM admin_users").get() as { c: number }).c;
  if (adminCount === 0) {
    const password = process.env.ADMIN_PASSWORD || "change-me-please";
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(
      "INSERT INTO admin_users (username, password_hash, display_name) VALUES (?, ?, ?)"
    ).run("admin", hash, "League Admin");
  }

  const gwCount = (db.prepare("SELECT COUNT(*) as c FROM gameweeks").get() as { c: number }).c;
  if (gwCount === 0) {
    db.prepare("INSERT INTO gameweeks (number, label, status) VALUES (1, 'Gameweek 1', 'active')").run();
  }
}
