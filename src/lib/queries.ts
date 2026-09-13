import { getDb } from "./db";
import { Position } from "./scoring";

export interface Team {
  id: number;
  name: string;
  captain: string;
  color: string;
  budget_remaining: number;
}

export interface Player {
  id: number;
  team_id: number | null;
  name: string;
  position: Position | null;
  price: number;
  last_season_points: number;
  is_captain: number;
  photo_url: string | null;
}

export interface Fixture {
  id: number;
  gameweek_id: number;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "final";
  played_at: string | null;
}

export interface Gameweek {
  id: number;
  number: number;
  label: string | null;
  status: "upcoming" | "active" | "completed";
}

export function getAllTeams(): Team[] {
  return getDb().prepare("SELECT * FROM teams ORDER BY name").all() as Team[];
}

export function getTeam(id: number): Team | undefined {
  return getDb().prepare("SELECT * FROM teams WHERE id = ?").get(id) as Team | undefined;
}

export function getPlayersByTeam(teamId: number): Player[] {
  return getDb()
    .prepare(
      "SELECT * FROM players WHERE team_id = ? ORDER BY CASE position WHEN 'GK' THEN 0 WHEN 'DEF' THEN 1 WHEN 'MID' THEN 2 ELSE 3 END, name"
    )
    .all(teamId) as Player[];
}

export function getPlayer(id: number): Player | undefined {
  return getDb().prepare("SELECT * FROM players WHERE id = ?").get(id) as Player | undefined;
}

export function getAllPlayers(): Player[] {
  return getDb().prepare("SELECT * FROM players ORDER BY name").all() as Player[];
}

export function getUnassignedPlayers(): Player[] {
  return getDb()
    .prepare("SELECT * FROM players WHERE team_id IS NULL ORDER BY last_season_points DESC, name")
    .all() as Player[];
}

export function getGameweeks(): Gameweek[] {
  return getDb().prepare("SELECT * FROM gameweeks ORDER BY number").all() as Gameweek[];
}

export function getGameweek(id: number): Gameweek | undefined {
  return getDb().prepare("SELECT * FROM gameweeks WHERE id = ?").get(id) as Gameweek | undefined;
}

export function getActiveGameweek(): Gameweek | undefined {
  const db = getDb();
  return (
    (db.prepare("SELECT * FROM gameweeks WHERE status = 'active' ORDER BY number DESC LIMIT 1").get() as
      | Gameweek
      | undefined) ??
    (db.prepare("SELECT * FROM gameweeks ORDER BY number DESC LIMIT 1").get() as Gameweek | undefined)
  );
}

export function getFixturesByGameweek(gameweekId: number): Fixture[] {
  return getDb()
    .prepare("SELECT * FROM fixtures WHERE gameweek_id = ? ORDER BY id")
    .all(gameweekId) as Fixture[];
}

export function getFixture(id: number): Fixture | undefined {
  return getDb().prepare("SELECT * FROM fixtures WHERE id = ?").get(id) as Fixture | undefined;
}

export interface PlayerStatRow {
  id: number;
  fixture_id: number;
  player_id: number;
  played: number;
  goals: number;
  assists: number;
  blue_cards: number;
  points: number;
  clean_sheet: number;
  goals_conceded: number;
}

export function getStatsForFixture(fixtureId: number): PlayerStatRow[] {
  return getDb()
    .prepare("SELECT * FROM player_stats WHERE fixture_id = ?")
    .all(fixtureId) as PlayerStatRow[];
}

export function getStatsForPlayer(playerId: number): (PlayerStatRow & { fixture: Fixture; gameweek: Gameweek })[] {
  const rows = getDb()
    .prepare(
      `SELECT ps.*, f.gameweek_id, f.home_team_id, f.away_team_id, f.home_score, f.away_score, f.status as fixture_status, f.played_at,
              g.number as gw_number, g.label as gw_label, g.status as gw_status, g.id as gw_id
       FROM player_stats ps
       JOIN fixtures f ON f.id = ps.fixture_id
       JOIN gameweeks g ON g.id = f.gameweek_id
       WHERE ps.player_id = ?
       ORDER BY g.number ASC`
    )
    .all(playerId) as any[];

  return rows.map((r) => ({
    id: r.id,
    fixture_id: r.fixture_id,
    player_id: r.player_id,
    played: r.played,
    goals: r.goals,
    assists: r.assists,
    blue_cards: r.blue_cards,
    points: r.points,
    clean_sheet: r.clean_sheet,
    goals_conceded: r.goals_conceded,
    fixture: {
      id: r.fixture_id,
      gameweek_id: r.gameweek_id,
      home_team_id: r.home_team_id,
      away_team_id: r.away_team_id,
      home_score: r.home_score,
      away_score: r.away_score,
      status: r.fixture_status,
      played_at: r.played_at,
    },
    gameweek: { id: r.gw_id, number: r.gw_number, label: r.gw_label, status: r.gw_status },
  }));
}

export function getTotalPointsForPlayer(playerId: number): number {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(points),0) as total FROM player_stats WHERE player_id = ?")
    .get(playerId) as { total: number };
  return row.total;
}

export function getTotalPointsByTeam(): Record<number, number> {
  const rows = getDb()
    .prepare(
      `SELECT p.team_id as team_id, COALESCE(SUM(ps.points),0) as total
       FROM players p
       LEFT JOIN player_stats ps ON ps.player_id = p.id
       GROUP BY p.team_id`
    )
    .all() as { team_id: number; total: number }[];
  const map: Record<number, number> = {};
  for (const r of rows) map[r.team_id] = r.total;
  return map;
}

export interface TeamRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

export function getTeamRecords(): Record<number, TeamRecord> {
  const fixtures = getDb()
    .prepare("SELECT * FROM fixtures WHERE status = 'final'")
    .all() as Fixture[];

  const records: Record<number, TeamRecord> = {};
  const ensure = (id: number) => {
    if (!records[id]) {
      records[id] = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
    }
    return records[id];
  };

  for (const f of fixtures) {
    if (f.home_score === null || f.away_score === null) continue;
    const home = ensure(f.home_team_id);
    const away = ensure(f.away_team_id);
    home.played += 1;
    away.played += 1;
    home.goalsFor += f.home_score;
    home.goalsAgainst += f.away_score;
    away.goalsFor += f.away_score;
    away.goalsAgainst += f.home_score;
    if (f.home_score > f.away_score) {
      home.won += 1;
      away.lost += 1;
    } else if (f.home_score < f.away_score) {
      away.won += 1;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
    }
  }

  return records;
}

export function getTopPerformers(gameweekId: number, limit = 8) {
  const rows = getDb()
    .prepare(
      `SELECT ps.*, pl.name as player_name, pl.position as position, pl.team_id as team_id, t.name as team_name, t.color as team_color
       FROM player_stats ps
       JOIN fixtures f ON f.id = ps.fixture_id
       JOIN players pl ON pl.id = ps.player_id
       JOIN teams t ON t.id = pl.team_id
       WHERE f.gameweek_id = ?
       ORDER BY ps.points DESC
       LIMIT ?`
    )
    .all(gameweekId, limit) as any[];
  return rows;
}

export interface AdminUserRow {
  id: number;
  username: string;
  display_name: string | null;
  created_at: string;
}

export function getAdminUsers(): AdminUserRow[] {
  return getDb()
    .prepare("SELECT id, username, display_name, created_at FROM admin_users ORDER BY created_at")
    .all() as AdminUserRow[];
}

export function getTransactionsForTeam(teamId: number) {
  return getDb()
    .prepare("SELECT * FROM transactions WHERE team_id = ? ORDER BY created_at DESC")
    .all(teamId);
}
