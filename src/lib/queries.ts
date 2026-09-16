import { all, get } from "./db";
import { LEAGUE_POINTS, Position } from "./scoring";

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

export function getAllTeams(): Promise<Team[]> {
  return all<Team>("SELECT * FROM teams ORDER BY name");
}

export function getTeam(id: number): Promise<Team | undefined> {
  return get<Team>("SELECT * FROM teams WHERE id = ?", [id]);
}

export function getPlayersByTeam(teamId: number): Promise<Player[]> {
  return all<Player>(
    "SELECT * FROM players WHERE team_id = ? ORDER BY CASE position WHEN 'GK' THEN 0 WHEN 'DEF' THEN 1 WHEN 'MID' THEN 2 ELSE 3 END, name",
    [teamId]
  );
}

export function getPlayer(id: number): Promise<Player | undefined> {
  return get<Player>("SELECT * FROM players WHERE id = ?", [id]);
}

export function getAllPlayers(): Promise<Player[]> {
  return all<Player>("SELECT * FROM players ORDER BY name");
}

export function getUnassignedPlayers(): Promise<Player[]> {
  return all<Player>("SELECT * FROM players WHERE team_id IS NULL ORDER BY last_season_points DESC, name");
}

export function getGameweeks(): Promise<Gameweek[]> {
  return all<Gameweek>("SELECT * FROM gameweeks ORDER BY number");
}

export function getGameweek(id: number): Promise<Gameweek | undefined> {
  return get<Gameweek>("SELECT * FROM gameweeks WHERE id = ?", [id]);
}

export async function getActiveGameweek(): Promise<Gameweek | undefined> {
  return (
    (await get<Gameweek>("SELECT * FROM gameweeks WHERE status = 'active' ORDER BY number DESC LIMIT 1")) ??
    (await get<Gameweek>("SELECT * FROM gameweeks ORDER BY number DESC LIMIT 1"))
  );
}

export function getFixturesByGameweek(gameweekId: number): Promise<Fixture[]> {
  return all<Fixture>("SELECT * FROM fixtures WHERE gameweek_id = ? ORDER BY id", [gameweekId]);
}

export function getFixture(id: number): Promise<Fixture | undefined> {
  return get<Fixture>("SELECT * FROM fixtures WHERE id = ?", [id]);
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

export function getStatsForFixture(fixtureId: number): Promise<PlayerStatRow[]> {
  return all<PlayerStatRow>("SELECT * FROM player_stats WHERE fixture_id = ?", [fixtureId]);
}

export interface FixtureStatLine extends PlayerStatRow {
  player_name: string;
  position: Position;
  team_id: number;
}

/** Match-detail rows: every player_stats row for a fixture, joined with the scorer's name/position/team. */
export function getFixtureStatLines(fixtureId: number): Promise<FixtureStatLine[]> {
  return all<FixtureStatLine>(
    `SELECT ps.*, pl.name as player_name, pl.position as position, pl.team_id as team_id
     FROM player_stats ps
     JOIN players pl ON pl.id = ps.player_id
     WHERE ps.fixture_id = ?
     ORDER BY ps.points DESC`,
    [fixtureId]
  );
}

export interface FixtureWithTeams extends Fixture {
  home_team_name: string;
  home_team_color: string;
  away_team_name: string;
  away_team_color: string;
  gw_number: number;
  gw_label: string | null;
}

export function getAllFixturesDesc(): Promise<FixtureWithTeams[]> {
  return all<FixtureWithTeams>(
    `SELECT f.*, ht.name as home_team_name, ht.color as home_team_color,
            at.name as away_team_name, at.color as away_team_color,
            g.number as gw_number, g.label as gw_label
     FROM fixtures f
     JOIN teams ht ON ht.id = f.home_team_id
     JOIN teams at ON at.id = f.away_team_id
     JOIN gameweeks g ON g.id = f.gameweek_id
     ORDER BY g.number DESC, f.id DESC`
  );
}

export async function getStatsForPlayer(
  playerId: number
): Promise<(PlayerStatRow & { fixture: Fixture; gameweek: Gameweek })[]> {
  const rows = await all<any>(
    `SELECT ps.*, f.gameweek_id, f.home_team_id, f.away_team_id, f.home_score, f.away_score, f.status as fixture_status, f.played_at,
            g.number as gw_number, g.label as gw_label, g.status as gw_status, g.id as gw_id
     FROM player_stats ps
     JOIN fixtures f ON f.id = ps.fixture_id
     JOIN gameweeks g ON g.id = f.gameweek_id
     WHERE ps.player_id = ?
     ORDER BY g.number ASC`,
    [playerId]
  );

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

export async function getTotalPointsForPlayer(playerId: number): Promise<number> {
  const row = await get<{ total: number }>(
    "SELECT COALESCE(SUM(points),0) as total FROM player_stats WHERE player_id = ?",
    [playerId]
  );
  return Number(row?.total ?? 0);
}

export async function getTotalPointsByTeam(): Promise<Record<number, number>> {
  const rows = await all<{ team_id: number; total: number }>(
    `SELECT p.team_id as team_id, COALESCE(SUM(ps.points),0) as total
     FROM players p
     LEFT JOIN player_stats ps ON ps.player_id = p.id
     GROUP BY p.team_id`
  );
  const map: Record<number, number> = {};
  for (const r of rows) if (r.team_id !== null) map[r.team_id] = Number(r.total);
  return map;
}

export interface TeamRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export async function getTeamRecords(): Promise<Record<number, TeamRecord>> {
  const fixtures = await all<Fixture>("SELECT * FROM fixtures WHERE status = 'final'");

  const records: Record<number, TeamRecord> = {};
  const ensure = (id: number) => {
    if (!records[id]) {
      records[id] = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
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

  for (const r of Object.values(records)) {
    r.points = r.won * LEAGUE_POINTS.WIN + r.drawn * LEAGUE_POINTS.DRAW + r.lost * LEAGUE_POINTS.LOSS;
  }

  return records;
}

export interface CumulativePerformerRow {
  player_id: number;
  player_name: string;
  position: Position;
  team_id: number;
  team_name: string;
  team_color: string;
  total_points: number;
  total_goals: number;
  total_assists: number;
  total_clean_sheets: number;
}

/**
 * Season-to-date leaderboard: every player's cumulative points/goals/assists/
 * clean sheets through (and including) the given gameweek number — not just
 * that single week's contribution.
 */
export function getCumulativeTopPerformers(uptoGwNumber: number, limit = 10): Promise<CumulativePerformerRow[]> {
  return all<CumulativePerformerRow>(
    `SELECT pl.id as player_id, pl.name as player_name, pl.position as position,
            pl.team_id as team_id, t.name as team_name, t.color as team_color,
            COALESCE(SUM(ps.points), 0) as total_points,
            COALESCE(SUM(ps.goals), 0) as total_goals,
            COALESCE(SUM(ps.assists), 0) as total_assists,
            COALESCE(SUM(ps.clean_sheet), 0) as total_clean_sheets
     FROM players pl
     JOIN teams t ON t.id = pl.team_id
     JOIN player_stats ps ON ps.player_id = pl.id
     JOIN fixtures f ON f.id = ps.fixture_id
     JOIN gameweeks g ON g.id = f.gameweek_id
     WHERE g.number <= ?
     GROUP BY pl.id
     ORDER BY total_points DESC, total_goals DESC, pl.name ASC
     LIMIT ?`,
    [uptoGwNumber, limit]
  );
}

export interface PlayerWithPoints extends Player {
  team_name: string | null;
  team_color: string | null;
  total_points: number;
}

/** Every drafted player ranked by cumulative season fantasy points — the FPL points table. */
export function getFplPointsTable(): Promise<PlayerWithPoints[]> {
  return all<PlayerWithPoints>(
    `SELECT pl.*, t.name as team_name, t.color as team_color,
            COALESCE(SUM(ps.points), 0) as total_points
     FROM players pl
     JOIN teams t ON t.id = pl.team_id
     LEFT JOIN player_stats ps ON ps.player_id = pl.id
     WHERE pl.team_id IS NOT NULL
     GROUP BY pl.id
     ORDER BY total_points DESC, pl.name ASC`
  );
}

export interface AdminUserRow {
  id: number;
  username: string;
  display_name: string | null;
  created_at: string;
}

export function getAdminUsers(): Promise<AdminUserRow[]> {
  return all<AdminUserRow>("SELECT id, username, display_name, created_at FROM admin_users ORDER BY created_at");
}

export function getTransactionsForTeam(teamId: number) {
  return all<any>("SELECT * FROM transactions WHERE team_id = ? ORDER BY created_at DESC", [teamId]);
}
