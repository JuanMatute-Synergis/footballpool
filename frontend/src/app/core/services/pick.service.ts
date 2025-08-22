import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  Pick, 
  PicksResponse, 
  SubmitPickRequest 
} from '../models/pick.model';

@Injectable({
  providedIn: 'root'
})
export class PickService {
  constructor(private http: HttpClient) {}

  getUserPicks(week?: number, season?: number): Observable<PicksResponse> {
    const params: any = {};
    if (week) params.week = week.toString();
    if (season) params.season = season.toString();

    return this.http.get<PicksResponse>(`${environment.apiUrl}/picks`, { params });
  }

  submitPick(pick: SubmitPickRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/picks`, pick);
  }

  getPicksForGame(gameId: number): Observable<{
    gameId: number;
    canSeeAllPicks: boolean;
    picks: Array<{
      userFirstName: string;
      userLastName: string;
      selectedTeamId: number;
      selectedTeamName: string;
      selectedTeamAbbreviation: string;
      mondayNightPrediction?: number;
    }>;
  }> {
    return this.http.get<any>(`${environment.apiUrl}/picks/game/${gameId}`);
  }

  getPicksHistory(limit = 10): Observable<{
    history: Array<{
      week: number;
      season: number;
      correctPicks: number;
      totalPicks: number;
      bonusPoints: number;
      totalPoints: number;
      mondayNightPrediction?: number;
      mondayNightActual?: number;
      mondayNightDiff?: number;
      isPerfectWeek: boolean;
    }>;
  }> {
    return this.http.get<any>(`${environment.apiUrl}/picks/history`, {
      params: { limit: limit.toString() }
    });
  }
}
