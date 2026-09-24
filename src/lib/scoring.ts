export type Position = "GK" | "DEF" | "MID" | "FWD";

export const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

export const POSITION_LABEL: Record<Position, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Striker",
};

/** Points scored per goal, by the position of the scorer. */
export const GOAL_POINTS: Record<Position, number> = {
  FWD: 4,
  MID: 5,
  DEF: 6,
  GK: 10,
};

export const ASSIST_POINTS = 3;
export const APPEARANCE_POINTS = 1;

/** Points for keeping a clean sheet (team concedes 0), by position. */
export const CLEAN_SHEET_POINTS: Record<Position, number> = {
  GK: 4,
  DEF: 4,
  MID: 1,
  FWD: 0,
};

/** -1 point for every 2 goals conceded, GK/DEF only. */
export const CONCEDED_PENALTY_PER_TWO = 1;

export const BLUE_CARD_POINTS = -1;
export const PENALTY_SAVE_POINTS = 5;
export const PENALTY_MISS_POINTS = -2;
export const OWN_GOAL_POINTS = -2;

export interface PlayerMatchInput {
  position: Position;
  played: boolean;
  goals: number;
  assists: number;
  teamGoalsConceded: number;
  blueCards: number;
  penaltySaves: number;
  penaltyMisses: number;
  ownGoals: number;
}

export interface PlayerMatchResult {
  points: number;
  cleanSheet: boolean;
  breakdown: {
    appearance: number;
    goals: number;
    assists: number;
    cleanSheet: number;
    concededPenalty: number;
    blueCards: number;
    penaltySaves: number;
    penaltyMisses: number;
    ownGoals: number;
  };
}

/**
 * Calculates fantasy points for one player in one fixture.
 * Clean sheet and the goals-conceded penalty are derived automatically
 * from the team's score line, never entered by hand.
 */
export function calculatePlayerMatchPoints(input: PlayerMatchInput): PlayerMatchResult {
  const { position, played, goals, assists, teamGoalsConceded, blueCards, penaltySaves, penaltyMisses, ownGoals } =
    input;

  if (!played) {
    return {
      points: 0,
      cleanSheet: false,
      breakdown: {
        appearance: 0,
        goals: 0,
        assists: 0,
        cleanSheet: 0,
        concededPenalty: 0,
        blueCards: 0,
        penaltySaves: 0,
        penaltyMisses: 0,
        ownGoals: 0,
      },
    };
  }

  const cleanSheet = teamGoalsConceded === 0;
  const appearance = APPEARANCE_POINTS;
  const goalPts = goals * GOAL_POINTS[position];
  const assistPts = assists * ASSIST_POINTS;
  const cleanSheetPts = cleanSheet ? CLEAN_SHEET_POINTS[position] : 0;
  const concededPenalty =
    position === "GK" || position === "DEF"
      ? Math.floor(teamGoalsConceded / 2) * CONCEDED_PENALTY_PER_TWO
      : 0;
  const blueCardPts = blueCards * BLUE_CARD_POINTS;
  const penaltySavePts = penaltySaves * PENALTY_SAVE_POINTS;
  const penaltyMissPts = penaltyMisses * PENALTY_MISS_POINTS;
  const ownGoalPts = ownGoals * OWN_GOAL_POINTS;

  const points =
    appearance +
    goalPts +
    assistPts +
    cleanSheetPts -
    concededPenalty +
    blueCardPts +
    penaltySavePts +
    penaltyMissPts +
    ownGoalPts;

  return {
    points,
    cleanSheet,
    breakdown: {
      appearance,
      goals: goalPts,
      assists: assistPts,
      cleanSheet: cleanSheetPts,
      concededPenalty: -concededPenalty,
      blueCards: blueCardPts,
      penaltySaves: penaltySavePts,
      penaltyMisses: penaltyMissPts,
      ownGoals: ownGoalPts,
    },
  };
}

export type MatchOutcome = "WIN" | "DRAW" | "LOSS";

/** Money (in millions) added to a team's transfer-market balance after a result. */
export const RESULT_BONUS: Record<MatchOutcome, number> = {
  WIN: 4,
  DRAW: 2,
  LOSS: 1,
};

export function outcomeFor(teamScore: number, opponentScore: number): MatchOutcome {
  if (teamScore > opponentScore) return "WIN";
  if (teamScore < opponentScore) return "LOSS";
  return "DRAW";
}

/** League table points for the standings — separate from fantasy scoring. */
export const LEAGUE_POINTS: Record<MatchOutcome, number> = {
  WIN: 2,
  DRAW: 1,
  LOSS: 0,
};
