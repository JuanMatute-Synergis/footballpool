import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { interval, Subject, takeUntil, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../core/services/game.service';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Game, GamesResponse } from '../../core/models/game.model';
import { LeaderboardEntry, WeeklyWinner } from '../../core/models/leaderboard.model';
import { environment } from '../../../environments/environment';
import { NavigationComponent } from '../../shared/components/navigation.component';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, FormsModule, NavigationComponent],
  template: `
    <div class="min-h-screen bg-gray-50">
      <app-navigation title="Game Results" [subtitle]="'Week ' + selectedWeek"></app-navigation>

      <!-- Content -->
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
          
          <!-- Week Selector -->
          <div class="flex justify-between items-center mb-6">
            <div class="flex items-center space-x-4">
              <label class="text-sm font-medium text-gray-700">Week:</label>
              <select [(ngModel)]="selectedWeek" (ngModelChange)="loadData()" class="input-field">
                <option *ngFor="let w of availableWeeks" [value]="w">Week {{ w }}</option>
              </select>
              <!-- Debug info -->
              <span *ngIf="isAdmin" class="text-xs text-green-600 font-bold">ADMIN MODE</span>
              <!-- Refresh button -->
              <button (click)="loadGames()" 
                      class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      [disabled]="loading">
                🔄 Refresh Scores
              </button>
              <!-- Live indicator -->
              <span *ngIf="hasGamesInProgress()" class="px-2 py-1 bg-red-100 text-red-800 text-xs rounded animate-pulse">
                🔴 LIVE
              </span>
            </div>
            <div class="text-sm text-gray-500">
              {{ currentSeason }} Season
            </div>
          </div>

          <!-- Loading -->
          <div *ngIf="loading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">Loading results...</p>
          </div>

          <!-- Error -->
          <div *ngIf="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p class="text-red-800">{{ error }}</p>
            <button (click)="loadData()" class="mt-2 btn-primary">Try Again</button>
          </div>

          <div *ngIf="!loading && !error" class="space-y-6">
            
            <!-- Weekly Winner -->
            <div *ngIf="weeklyWinner" class="card">
              <div class="p-6 bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400">
                <h2 class="text-xl font-bold text-yellow-800 mb-2">🏆 Week {{ selectedWeek }} Winner</h2>
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-lg font-semibold text-yellow-900">{{ weeklyWinner.firstName }} {{ weeklyWinner.lastName }}</p>
                    <p class="text-yellow-700">{{ weeklyWinner.points }} points</p>
                  </div>
                  <div class="text-right">
                    <p class="text-2xl font-bold text-yellow-800">{{ weeklyWinner.points }}</p>
                    <p class="text-sm text-yellow-600">points</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top 3 Leaderboard -->
            <div class="card">
              <div class="p-6 border-b">
                <h2 class="text-lg font-semibold">Top 3 This Week</h2>
              </div>
              <div class="p-6">
                <div class="space-y-3">
                  <div *ngFor="let entry of top3; let i = index"
                       class="flex items-center justify-between p-3 rounded-lg"
                       [class]="i === 0 ? 'bg-yellow-50 border border-yellow-200' :
                               i === 1 ? 'bg-gray-50 border border-gray-200' :
                               'bg-orange-50 border border-orange-200'">
                    <div class="flex items-center space-x-3">
                      <div class="text-2xl">
                        {{ i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉' }}
                      </div>
                      <div>
                        <div class="font-semibold">
                          {{ entry.firstName }} {{ entry.lastName }}
                          <span *ngIf="isAdmin" class="ml-2 text-sm font-normal text-gray-600">
                            ({{ getActualPickCount(entry.userId) }}/{{ games ? games.length : 0 }})
                          </span>
                        </div>
                        <div class="text-sm text-gray-600">
                          {{ entry.correctPicks }}/{{ totalGames }} correct
                          <span *ngIf="isAdmin && (entry.totalPicks || 0) < totalGames" class="text-red-600 font-medium">
                            ({{ totalGames - (entry.totalPicks || 0) }} missing picks)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-lg font-bold">{{ entry.totalPoints }}</div>
                      <div class="text-xs text-gray-500">points</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Full Leaderboard (Admin Only) -->
            <div *ngIf="isAdmin && leaderboard.length > 0" class="card">
              <div class="p-6 border-b">
                <h2 class="text-lg font-semibold">All Players Pick Status (Admin View)</h2>
              </div>
              <div class="p-6">
                <div class="space-y-2">
                  <div *ngFor="let entry of leaderboard; let i = index"
                       class="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                       [class.bg-red-50]="getActualPickCount(entry.userId) < (games ? games.length : 0)">
                    <div class="flex items-center space-x-3">
                      <div class="text-sm font-medium w-8">{{ i + 1 }}</div>
                      <div>
                        <div class="font-medium">
                          {{ entry.firstName }} {{ entry.lastName }}
                          <span class="ml-2 text-sm font-normal text-gray-600">
                            ({{ getActualPickCount(entry.userId) }}/{{ totalGames }})
                          </span>
                        </div>
                        <div class="text-sm text-gray-600">
                          Picks: {{ getActualPickCount(entry.userId) }}/{{ totalGames }}
                          <span *ngIf="getActualPickCount(entry.userId) < totalGames" class="text-red-600 font-medium">
                            ({{ totalGames - getActualPickCount(entry.userId) }} missing)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="font-bold">{{ entry.totalPoints }} pts</div>
                      <div class="text-xs text-gray-500">{{ entry.correctPicks }}/{{ entry.totalPicks }} correct</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- All Games Results -->
            <div class="card">
              <div class="p-6 border-b">
                <h2 class="text-lg font-semibold">Game Results</h2>
              </div>
              <div class="p-6">
                <div *ngIf="games.length === 0" class="text-center py-8 text-gray-500">
                  No games available for this week.
                </div>
                
                <div class="space-y-4">
                  <div *ngFor="let game of games" class="border border-gray-200 rounded-lg p-4">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-4">
                        <!-- Visitor Team -->
                        <div class="flex items-center space-x-3">
                          <img [src]="getTeamLogo(game.visitorTeam.abbreviation)" 
                               [alt]="game.visitorTeam.name" 
                               class="w-8 h-8 object-contain"
                               (error)="handleImageError($event, game.visitorTeam.abbreviation)"
                               loading="lazy">
                          <div>
                            <div class="font-semibold">{{ game.visitorTeam.name }}</div>
                            <div class="text-sm text-gray-500">{{ game.visitorTeam.abbreviation }}</div>
                          </div>
                        </div>
                        
                        <!-- Score -->
                        <div class="text-center min-w-[80px]">
                          <div *ngIf="game.status === 'final'" class="text-lg font-bold">
                            {{ game.visitorTeam.score }} - {{ game.homeTeam.score }}
                          </div>
                          <div *ngIf="game.status === 'in_progress'" class="text-blue-600 font-semibold">
                            LIVE
                          </div>
                          <div *ngIf="game.status === 'scheduled'" class="text-sm text-gray-500">
                            {{ formatGameTime(game.date) }}
                          </div>
                        </div>
                        
                        <!-- Home Team -->
                        <div class="flex items-center space-x-3">
                          <div class="text-right">
                            <div class="font-semibold">{{ game.homeTeam.name }}</div>
                            <div class="text-sm text-gray-500">{{ game.homeTeam.abbreviation }}</div>
                          </div>
                          <img [src]="getTeamLogo(game.homeTeam.abbreviation)" 
                               [alt]="game.homeTeam.name" 
                               class="w-8 h-8 object-contain"
                               (error)="handleImageError($event, game.homeTeam.abbreviation)"
                               loading="lazy">
                        </div>
                      </div>
                      
                      <!-- Status -->
                      <div class="text-right">
                        <span [class]="getGameStatusClass(game.status)">
                          {{ getGameStatusText(game.status) }}
                        </span>
                        <div *ngIf="game.isTiebreaker" class="mt-1">
                          <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">TB</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class ResultsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private gameService = inject(GameService);
  private leaderboardService = inject(LeaderboardService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  loading = false;
  error = '';

  currentSeason!: number;
  selectedWeek = 1;
  availableWeeks: number[] = [];

  games: Game[] = [];
  leaderboard: LeaderboardEntry[] = [];
  userPickCounts: { [userId: number]: number } = {}; // Store actual pick counts for admin
  top3: LeaderboardEntry[] = [];
  weeklyWinner: WeeklyWinner | null = null;
  totalGames = 16; // Total games in the week

  get isAdmin(): boolean {
    return this.authService.isAdmin;
  }

  ngOnInit() {
    // Calculate current season - NFL season spans two calendar years
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11
    
    // If we're in January or early February, we're still in the previous year's NFL season
    if (month === 0 || (month === 1 && now.getDate() < 15)) {
      this.currentSeason = year - 1;
    } else {
      this.currentSeason = year;
    }
    
    console.log('Current date:', now.toISOString());
    console.log('Calculated NFL season:', this.currentSeason);
    
    // Load available weeks first
    this.loadAvailableWeeks().then(() => {
      this.loadData();
    });

    // Auto-refresh every 30 seconds when games are in progress
    // or every 2 minutes during potential game times
    const refreshInterval = this.hasGamesInProgress() ? 30000 : 120000;
    interval(refreshInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.hasGamesInProgress()) {
          this.loadGames();
        }
      });
  }

  loadAvailableWeeks(): Promise<void> {
    return new Promise((resolve) => {
      // Get all distinct weeks from the current season
      this.http.get<any>(`${this.baseUrl}/api/leaderboard/weekly-leaderboard?season=${this.currentSeason}&week=1`)
        .subscribe({
          next: () => {
            // Generate weeks 1-18, but filter out Week 0 if it somehow gets in
            this.availableWeeks = Array.from({ length: 18 }, (_, i) => i + 1).filter(week => week > 0);

            // Set current week as selected if not already set
            if (this.selectedWeek === 1) {
              // Try to get current week from game service
              this.gameService.getCurrentWeekGames().subscribe({
                next: (response) => {
                  this.selectedWeek = response.week > 0 ? response.week : 1;
                  resolve();
                },
                error: () => {
                  this.selectedWeek = 1;
                  resolve();
                }
              });
            } else {
              resolve();
            }
          },
          error: () => {
            // Fallback to weeks 1-18, filtering out Week 0
            this.availableWeeks = Array.from({ length: 18 }, (_, i) => i + 1).filter(week => week > 0);
            resolve();
          }
        });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData() {
    this.loading = true;
    this.error = '';

    console.log('loadData called with season:', this.currentSeason, 'week:', this.selectedWeek);

    // Load games and leaderboard in parallel
    const currentWeek$ = this.gameService.getWeekGames(this.currentSeason, this.selectedWeek);
    const leaderboard$ = this.leaderboardService.getWeeklyLeaderboard(this.selectedWeek, this.currentSeason);

    currentWeek$.pipe(
      switchMap((gameResponse: GamesResponse) => {
        this.games = gameResponse.games;
        return leaderboard$;
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (leaderboardResponse: any) => {
        this.leaderboard = leaderboardResponse.leaderboard || [];
        this.totalGames = leaderboardResponse.totalGames || this.games.length || 16;
        this.top3 = this.leaderboard.slice(0, 3);
        this.loading = false;
        this.loadWeeklyWinner();
        // Load actual pick counts for admin display
        console.log('Is admin?', this.isAdmin);
        if (this.isAdmin) {
          console.log('Loading actual pick counts...');
          this.loadActualPickCounts();
        }
      },
      error: (err: any) => {
        console.error('Error loading data:', err);
        this.error = 'Failed to load game results';
        this.loading = false;
      }
    });
  }

  loadGames() {
    // Quick refresh for games only (used by auto-refresh)
    this.gameService.getWeekGames(this.currentSeason, this.selectedWeek)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: GamesResponse) => {
          this.games = response.games;
        },
        error: (err: any) => {
          console.error('Error refreshing games:', err);
        }
      });
  }

  loadWeeklyWinner() {
    // Load weekly winners
    this.http.get(`${this.baseUrl}/api/leaderboard/weekly-winners`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.weeklyWinner = response.winners.find((w: any) => w.week === this.selectedWeek) || null;
        },
        error: (err: any) => {
          console.error('Error loading weekly winner:', err);
        }
      });
  }

  loadActualPickCounts() {
    console.log('loadActualPickCounts called for week', this.selectedWeek, 'season', this.currentSeason);
    // Load actual pick counts for each user for admin display
    this.http.get(`${this.baseUrl}/api/admin/picks?week=${this.selectedWeek}&season=${this.currentSeason}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          console.log('Admin picks response:', response);
          this.userPickCounts = {};
          // Group picks by user and count them
          if (response.picks) {
            response.picks.forEach((pick: any) => {
              if (!this.userPickCounts[pick.userId]) {
                this.userPickCounts[pick.userId] = 0;
              }
              this.userPickCounts[pick.userId]++;
            });
          }
          console.log('User pick counts:', this.userPickCounts);
        },
        error: (err: any) => {
          console.error('Error loading pick counts:', err);
        }
      });
  }

  getActualPickCount(userId: number): number {
    return this.userPickCounts[userId] || 0;
  }

  hasGamesInProgress(): boolean {
    const now = new Date();
    return this.games.some(game => {
      // Check if game is currently in progress
      if (game.status === 'in_progress') {
        return true;
      }

      // Also check if game is scheduled to start soon (within next 4 hours)
      // or recently finished (within last 2 hours) to catch live updates
      if (game.status === 'scheduled') {
        const gameTime = new Date(game.date);
        const timeDiff = gameTime.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        // Refresh if game starts within 4 hours
        return hoursDiff <= 4 && hoursDiff >= -2;
      }

      return false;
    });
  }

  getGameStatusClass(status: string): string {
    switch (status) {
      case 'scheduled':
        return 'px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs';
      case 'in_progress':
        return 'px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs animate-pulse';
      case 'final':
        return 'px-2 py-1 bg-green-100 text-green-800 rounded text-xs';
      default:
        return 'px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs';
    }
  }

  getGameStatusText(status: string): string {
    switch (status) {
      case 'scheduled':
        return 'Scheduled';
      case 'in_progress':
        return 'Live';
      case 'final':
        return 'Final';
      default:
        return status;
    }
  }

  formatGameTime(gameTime: string): string {
    const date = new Date(gameTime);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  getTeamLogo(abbreviation: string): string {
    return `${this.baseUrl}/team-logos/${abbreviation?.toLowerCase()}_logo.png`;
  }

  handleImageError(event: Event, teamAbbreviation: string): void {
    const imgElement = event.target as HTMLImageElement;
    // Fallback to ESPN logo if server logo fails
    imgElement.src = `https://a.espncdn.com/i/teamlogos/nfl/500/${teamAbbreviation?.toUpperCase()}.png`;
  }
}
