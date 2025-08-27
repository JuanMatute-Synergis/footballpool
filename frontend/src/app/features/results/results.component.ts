import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { interval, Subject, takeUntil, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../core/services/game.service';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { HttpClient } from '@angular/common/http';
import { Game, GamesResponse } from '../../core/models/game.model';
import { LeaderboardEntry, WeeklyWinner } from '../../core/models/leaderboard.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <div class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="py-6">
            <h1 class="text-3xl font-bold text-gray-900">Game Results</h1>
            <p class="mt-1 text-sm text-gray-500">View completed games and weekly winners</p>
          </div>
        </div>
      </div>

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
            
            <!-- Weekly Winner Card -->
            <div *ngIf="weeklyWinner" class="card p-6 bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-xl font-bold text-yellow-800 mb-1">🏆 Week {{ selectedWeek }} Winner</h2>
                  <div class="text-2xl font-bold text-yellow-900">
                    {{ weeklyWinner.firstName }} {{ weeklyWinner.lastName }}
                  </div>
                  <div class="text-sm text-yellow-700 mt-1">
                    {{ weeklyWinner.points }} points
                    <span *ngIf="weeklyWinner.isTie" class="ml-2 px-2 py-1 bg-yellow-200 rounded text-xs">TIE</span>
                    <span *ngIf="weeklyWinner.tieBreakerDiff !== null" class="ml-2">
                      (MNF Diff: {{ weeklyWinner.tieBreakerDiff }})
                    </span>
                  </div>
                </div>
                <div class="text-6xl">🏆</div>
              </div>
            </div>

            <!-- Games Results -->
            <div class="card">
              <div class="p-6 border-b">
                <h2 class="text-lg font-semibold">Game Results</h2>
              </div>
              
              <div class="divide-y divide-gray-200">
                <div *ngFor="let game of games" class="p-6">
                  <div class="flex items-center justify-between">
                    <!-- Game Info -->
                    <div class="flex-1">
                      <div class="flex items-center space-x-4">
                        <!-- Away Team -->
                        <div class="flex items-center space-x-3">
                          <img [src]="getTeamLogo(game.visitorTeam.abbreviation)" 
                               [alt]="game.visitorTeam.name" 
                               class="w-8 h-8 object-contain"
                               (error)="handleImageError($event, game.visitorTeam.abbreviation)"
                               loading="lazy">
                          <div>
                            <div class="font-semibold" [class]="getTeamScoreClass(game.visitorTeam.score, game.homeTeam.score)">
                              {{ game.visitorTeam.name }}
                            </div>
                            <div class="text-lg font-bold" [class]="getTeamScoreClass(game.visitorTeam.score, game.homeTeam.score)">
                              {{ game.visitorTeam.score ?? '-' }}
                            </div>
                          </div>
                        </div>

                        <!-- VS -->
                        <div class="text-gray-400 font-medium">&#64;</div>

                        <!-- Home Team -->
                        <div class="flex items-center space-x-3">
                          <img [src]="getTeamLogo(game.homeTeam.abbreviation)" 
                               [alt]="game.homeTeam.name" 
                               class="w-8 h-8 object-contain"
                               (error)="handleImageError($event, game.homeTeam.abbreviation)"
                               loading="lazy">
                          <div>
                            <div class="font-semibold" [class]="getTeamScoreClass(game.homeTeam.score, game.visitorTeam.score)">
                              {{ game.homeTeam.name }}
                            </div>
                            <div class="text-lg font-bold" [class]="getTeamScoreClass(game.homeTeam.score, game.visitorTeam.score)">
                              {{ game.homeTeam.score ?? '-' }}
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Game Details -->
                      <div class="mt-3 flex items-center space-x-4 text-sm text-gray-600">
                        <span>{{ formatGameTime(game.date) }}</span>
                        <span *ngIf="game.status === 'final'" class="text-green-600 font-medium">Final</span>
                        <span *ngIf="game.status === 'in_progress'" class="text-blue-600 font-medium">In Progress</span>
                        <span *ngIf="game.status === 'scheduled'" class="text-gray-500">Scheduled</span>
                      </div>
                    </div>

                    <!-- Winner Indicator -->
                    <div *ngIf="game.status === 'final'" class="ml-4">
                      <div class="text-right">
                        <div class="text-sm text-gray-600">Winner</div>
                        <div class="font-bold text-green-600">
                          {{ getWinner(game) }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Monday Night Special -->
                  <div *ngIf="game.isMonday" class="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div class="flex items-center space-x-2">
                      <div class="text-yellow-600 font-semibold">🏈 Monday Night Football</div>
                      <div *ngIf="game.status === 'final'" class="text-sm text-gray-600">
                        Total: {{ (game.homeTeam.score || 0) + (game.visitorTeam.score || 0) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Week Summary Stats -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="card p-6 text-center">
                <div class="text-2xl font-bold text-blue-600">{{ completedGames }}</div>
                <div class="text-sm text-gray-600 mt-1">Games Completed</div>
              </div>
              <div class="card p-6 text-center">
                <div class="text-2xl font-bold text-green-600">{{ upsets }}</div>
                <div class="text-sm text-gray-600 mt-1">Upsets</div>
              </div>
              <div class="card p-6 text-center">
                <div class="text-2xl font-bold text-purple-600">{{ averageScore }}</div>
                <div class="text-sm text-gray-600 mt-1">Avg Total Score</div>
              </div>
            </div>

            <!-- Top 3 This Week -->
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
                        <div class="font-semibold">{{ entry.firstName }} {{ entry.lastName }}</div>
                        <div class="text-sm text-gray-600">
                          {{ entry.correctPicks }}/{{ entry.totalPicks }} correct
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
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class ResultsComponent implements OnInit {
  private gameService = inject(GameService);
  private leaderboardService = inject(LeaderboardService);
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;


  loading = false;
  error = '';
  
  currentSeason = new Date().getFullYear();
  selectedWeek = 1;
  availableWeeks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  
  games: Game[] = [];
  weeklyWinner: WeeklyWinner | null = null;
  top3: LeaderboardEntry[] = [];

  getTeamLogo(abbreviation: string): string {
    // Simply return the server-side logo endpoint
    // The server handles all caching and fallbacks internally
    return `${this.baseUrl}/team-logos/${abbreviation?.toLowerCase()}_logo.png`;
  }

  private loadTeamLogos(): void {
    // No longer needed - server handles everything
    // Keep method for backward compatibility but it's now a no-op
  }

  ngOnInit() {
    this.loadData();
    this.startLivePolling();
  }

  private destroy$ = new Subject<void>();

  startLivePolling() {
    // Poll every 15 seconds for live updates
    interval(15000)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.gameService.getLiveGames())
      )
      .subscribe({
        next: (res) => {
          // Only update if the live response matches the currently selected week/season
          if (res.week === this.selectedWeek && res.season === this.currentSeason) {
            this.games = res.games;
          }
        },
        error: (err) => {
          // Ignore transient live fetch errors; keep existing UI
          console.warn('Live games polling error:', err);
        }
      });
  }

  loadData() {
    this.loading = true;
    this.error = '';
    
    // Load games for the week
    this.gameService.getWeekGames(this.currentSeason, this.selectedWeek).subscribe({
      next: (response: GamesResponse) => {
        this.games = response.games;
        this.loadWeeklyResults();
      },
      error: (error: any) => {
        console.error('Error loading games:', error);
        this.error = 'Failed to load game results';
        this.loading = false;
      }
    });
  }

  loadWeeklyResults() {
    // Load weekly winner
    this.leaderboardService.getWeeklyWinners(1).subscribe({
      next: (response) => {
        this.weeklyWinner = response.winners.find(w => w.week === this.selectedWeek) || null;
      },
      error: (error: any) => {
        console.error('Error loading weekly winner:', error);
      }
    });

    // Load top 3 for this week
    this.leaderboardService.getWeeklyLeaderboard(this.selectedWeek, this.currentSeason).subscribe({
      next: (response) => {
        this.top3 = response.leaderboard.slice(0, 3);
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading weekly leaderboard:', error);
        this.loading = false;
      }
    });
  }

  getTeamScoreClass(teamScore: number | undefined, opponentScore: number | undefined): string {
    if (teamScore === undefined || opponentScore === undefined) return 'text-gray-600';
    if (teamScore > opponentScore) return 'text-green-600';
    if (teamScore < opponentScore) return 'text-gray-500';
    return 'text-yellow-600'; // tie
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

  getWinner(game: Game): string {
    if (game.homeTeam.score === undefined || game.visitorTeam.score === undefined) return '';
    if (game.homeTeam.score > game.visitorTeam.score) return game.homeTeam.name;
    if (game.visitorTeam.score > game.homeTeam.score) return game.visitorTeam.name;
    return 'Tie';
  }

  get completedGames(): number {
    return this.games.filter(g => g.status === 'final').length;
  }

  get upsets(): number {
    // This would calculate actual upsets based on spreads
    // For now, just return a placeholder
    return Math.floor(this.completedGames * 0.3);
  }

  get averageScore(): string {
    const completed = this.games.filter(g => 
      g.status === 'final' && 
      g.homeTeam.score !== undefined && 
      g.visitorTeam.score !== undefined
    );
    if (completed.length === 0) return '0';
    
    const totalScore = completed.reduce((sum, game) => 
      sum + (game.homeTeam.score || 0) + (game.visitorTeam.score || 0), 0);
    return (totalScore / completed.length).toFixed(1);
  }

  handleImageError(event: Event, teamAbbreviation: string): void {
    const imgElement = event.target as HTMLImageElement;
    // Fallback to ESPN logo if server logo fails
    imgElement.src = `https://a.espncdn.com/i/teamlogos/nfl/500/${teamAbbreviation?.toUpperCase()}.png`;
  }
}
