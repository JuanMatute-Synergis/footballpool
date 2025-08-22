export interface Team {
  id: number;
  name: string;
  city: string;
  abbreviation: string;
  conference: string;
  division: string;
  logo?: string;
}

export interface Game {
  id: number;
  week: number;
  season: number;
  date: string;
  status: 'scheduled' | 'in_progress' | 'final';
  isMonday: boolean;
  homeTeam: Team & { score?: number };
  visitorTeam: Team & { score?: number };
}

export interface GamesResponse {
  week: number;
  season: number;
  games: Game[];
}
