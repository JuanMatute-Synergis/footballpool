export interface LeaderboardEntry {
  rank: number;
  userId: number;
  firstName: string;
  lastName: string;
  correctPicks?: number;
  totalPicks?: number;
  bonusPoints?: number;
  totalPoints: number;
  mondayNightPrediction?: number;
  mondayNightActual?: number;
  mondayNightDiff?: number;
  isPerfectWeek?: boolean;
  weeksPlayed?: number;
  totalCorrectPicks?: number;
  totalBonusPoints?: number;
  avgWeeklyPoints?: number;
  perfectWeeks?: number;
}

export interface WeeklyLeaderboardResponse {
  week: number;
  season: number;
  leaderboard: LeaderboardEntry[];
}

export interface SeasonLeaderboardResponse {
  season: number;
  leaderboard: LeaderboardEntry[];
}

export interface WeeklyWinner {
  week: number;
  season: number;
  userId: number;
  firstName: string;
  lastName: string;
  points: number;
  isTie: boolean;
  tieBreakerDiff?: number;
  tiebreakerUsed?: boolean;
}

export interface UserStats {
  season: number;
  userId: number;
  weeksPlayed: number;
  totalCorrectPicks: number;
  totalPicks: number;
  totalBonusPoints: number;
  totalPoints: number;
  avgWeeklyPoints: number;
  perfectWeeks: number;
  bestWeekPoints: number;
  worstWeekPoints: number;
  weeklyWins: number;
  accuracy: number;
}
