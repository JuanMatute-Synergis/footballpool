export interface Team {
  id: number;
  name: string;
  city: string;
  abbreviation: string;
  conference: string;
  division: string;
  logo?: string;
}

export interface QuarterScores {
  q1: number | null;
  q2: number | null;
  q3: number | null;
  q4: number | null;
  ot: number | null;
}

export interface Game {
  id: number;
  week: number;
  season: number;
  date: string;
  status: 'scheduled' | 'in_progress' | 'final' | 'live';
  isTiebreaker: boolean;
  quarterTimeRemaining?: string | null;
  liveStatus?: string | null;
  homeTeam: Team & {
    score?: number;
    quarters?: QuarterScores;
  };
  visitorTeam: Team & {
    score?: number;
    quarters?: QuarterScores;
  };
}

export interface GamesResponse {
  week: number;
  season: number;
  games: Game[];
}
