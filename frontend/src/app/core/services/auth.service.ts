import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User
} from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private tokenKey = 'nfl_picks_token';

  constructor(private http: HttpClient) {
    // Don't initialize here - let APP_INITIALIZER handle it
  }

  // Method for APP_INITIALIZER to call
  initializeAuth(): Promise<void> {
    return new Promise((resolve) => {
      const token = this.getToken();
      if (token) {
        // Token exists, verify it's still valid by getting user profile
        this.getProfile().subscribe({
          next: (response) => {
            console.log('User authenticated on app start:', response.user.email);
            resolve();
          },
          error: (error) => {
            // Only logout on explicit unauthorized errors. Network or CORS errors shouldn't force logout.
            const status = error?.status;
            if (status === 401 || status === 403) {
              console.log('Token expired or invalid, logging out');
              this.logout();
            } else {
              console.log('Network/CORS error while verifying token, keeping local session until explicit auth failure');
            }
            resolve();
          }
        });
      } else {
        // No token, resolve immediately
        resolve();
      }
    });
  }

  get isAuthenticated(): boolean {
    return !!this.getToken();
  }

  get isAdmin(): boolean {
    return this.currentUserSubject.value?.isAdmin || false;
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(response => {
          this.setToken(response.token);
          this.currentUserSubject.next(response.user);
        })
      );
  }

  register(userData: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, userData)
      .pipe(
        tap(response => {
          this.setToken(response.token);
          this.currentUserSubject.next(response.user);
        })
      );
  }

  logout(): void {
    this.removeToken();
    this.currentUserSubject.next(null);
  }

  getProfile(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(`${environment.apiUrl}/auth/profile`)
      .pipe(
        tap(response => {
          this.currentUserSubject.next(response.user);
        })
      );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${environment.apiUrl}/auth/change-password`, {
      currentPassword,
      newPassword
    });
  }

  private loadCurrentUser(): void {
    const token = this.getToken();
    if (token) {
      this.getProfile().subscribe({
        error: () => {
          this.logout();
        }
      });
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  private removeToken(): void {
    localStorage.removeItem(this.tokenKey);
  }
}
