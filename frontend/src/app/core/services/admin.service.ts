import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, CreateUserRequest, UpdateUserRequest } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private http: HttpClient) {}

  // Users
  getAllUsers(): Observable<{ users: User[] }> {
    return this.http.get<{ users: User[] }>(`${environment.apiUrl}/admin/users`);
  }

  createUser(userData: CreateUserRequest): Observable<{ user: User }> {
    return this.http.post<{ user: User }>(`${environment.apiUrl}/admin/users`, userData);
  }

  updateUser(userId: number, userData: UpdateUserRequest): Observable<{ user: User }> {
    return this.http.put<{ user: User }>(`${environment.apiUrl}/admin/users/${userId}`, userData);
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/admin/users/${userId}`);
  }

  // Games
  updateGame(gameId: number, gameData: any): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/admin/games/${gameId}`, gameData);
  }

  syncGames(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/admin/sync-games`, {});
  }

  updateAllScores(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/admin/update-scores`, {});
  }

  // Settings
  updateSettings(settings: any): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/admin/settings`, settings);
  }

  // Maintenance
  resetWeekPicks(week: number): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/admin/reset-picks/${week}`, {});
  }

  recalculateScores(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/admin/recalculate-scores`, {});
  }

  getAllPicks(week?: number, season?: number, userId?: number): Observable<{ picks: any[] }> {
    const params: any = {};
    if (week) params.week = week.toString();
    if (season) params.season = season.toString();
    if (userId) params.userId = userId.toString();

    return this.http.get<{ picks: any[] }>(`${environment.apiUrl}/admin/picks`, { params });
  }
}
