import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  WeeklyLeaderboardResponse,
  SeasonLeaderboardResponse,
  WeeklyWinner,
  UserStats
} from '../models/leaderboard.model';

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  constructor(private http: HttpClient) { }

  getWeeklyLeaderboard(week?: number, season?: number): Observable<WeeklyLeaderboardResponse> {
    const params: any = {};
    if (week) params.week = week.toString();
    if (season) params.season = season.toString();

    return this.http.get<WeeklyLeaderboardResponse>(`${environment.apiUrl}/leaderboard/weekly`, { params });
  }

  getSeasonLeaderboard(season?: number): Observable<SeasonLeaderboardResponse> {
    const params: any = {};
    if (season) params.season = season.toString();

    return this.http.get<SeasonLeaderboardResponse>(`${environment.apiUrl}/leaderboard/season`, { params });
  }

  getWeeklyWinners(season?: number, limit = 10): Observable<{ winners: WeeklyWinner[] }> {
    const params: any = { limit: limit.toString() };
    if (season) params.season = season.toString();

    return this.http.get<{ winners: WeeklyWinner[] }>(`${environment.apiUrl}/leaderboard/winners`, { params });
  }

  getUserStats(season?: number): Observable<UserStats> {
    const params: any = {};
    if (season) params.season = season.toString();

    return this.http.get<UserStats>(`${environment.apiUrl}/leaderboard/stats`, { params });
  }
}
