export interface Pick {
  id?: number;
  gameId: number;
  selectedTeamId: number;
  selectedTeamName?: string;
  selectedTeamAbbreviation?: string;
  mondayNightPrediction?: number;
  gameDate?: string;
  gameStatus?: string;
  isCorrect?: boolean | null;
  homeTeam?: {
    name: string;
    abbreviation: string;
  };
  visitorTeam?: {
    name: string;
    abbreviation: string;
  };
}

export interface PicksResponse {
  week: number;
  season: number;
  picks: Pick[];
}

export interface SubmitPickRequest {
  gameId: number;
  selectedTeamId: number;
  mondayNightPrediction?: number;
}
