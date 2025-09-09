import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Game, GamesResponse, Team } from '../models/game.model';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  constructor(private http: HttpClient) { }

  getCurrentWeekGames(): Observable<GamesResponse> {
    return this.http.get<GamesResponse>(`${environment.apiUrl}/games/current`);
  }

  getCurrentWeekGamesForDisplay(): Observable<GamesResponse> {
    return this.http.get<GamesResponse>(`${environment.apiUrl}/games/current-display`);
  }

  getWeekGames(season: number, week: number): Observable<GamesResponse> {
    return this.http.get<GamesResponse>(`${environment.apiUrl}/games/${season}/${week}`);
  }

  getAllTeams(): Observable<{ teams: Team[] }> {
    return this.http.get<{ teams: Team[] }>(`${environment.apiUrl}/games/teams`);
  }

  getLiveGames(): Observable<{ week: number; season: number; games: Game[] }> {
    return this.http.get<{ week: number; season: number; games: Game[] }>(`${environment.apiUrl}/games/live`);
  }
}
