import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { GameService } from '../../core/services/game.service';
import { PickService } from '../../core/services/pick.service';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { HttpClient } from '@angular/common/http';
import { Game, GamesResponse } from '../../core/models/game.model';
import { Pick, PicksResponse } from '../../core/models/pick.model';
import { LeaderboardEntry } from '../../core/models/leaderboard.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Navigation -->
      <nav class="bg-white shadow-sm border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16">
            <div class="flex items-center">
              <h1 class="text-xl font-bold text-gray-900">🏈 NFL Weekly Picks</h1>
            </div>
            <div class="flex items-center space-x-4">
              <span class="text-gray-700">
                Welcome, {{ currentUser?.firstName }} {{ currentUser?.lastName }}!
                <span *ngIf="currentUser?.isAdmin" class="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Admin</span>
              </span>
              <button 
                (click)="logout()"
                class="text-gray-500 hover:text-gray-700">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <!-- Main Content -->
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
          
          <!-- Loading -->
          <div *ngIf="loading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">Loading your dashboard...</p>
          </div>

          <!-- Error -->
          <div *ngIf="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p class="text-red-800">{{ error }}</p>
            <button (click)="loadDashboardData()" class="mt-2 btn-primary">Try Again</button>
          </div>

          <div *ngIf="!loading" class="space-y-8">
            
            <!-- Welcome Header -->
            <div class="text-center">
              <h2 class="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                Welcome back, {{ currentUser?.firstName }}!
              </h2>
              <p class="mt-4 text-xl text-gray-600">
                NFL Picks - Week {{ currentWeek }} of {{ currentSeason }}
              </p>
            </div>
            
            <!-- Quick Stats -->
            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div class="card p-6 text-center">
                <h3 class="text-lg font-medium text-gray-900">Picks This Week</h3>
                <p class="mt-2 text-3xl font-extrabold text-blue-600">{{ currentWeekPicks }}</p>
                <p class="mt-1 text-gray-500">out of {{ totalGames }}</p>
              </div>
              
              <div class="card p-6 text-center">
                <h3 class="text-lg font-medium text-gray-900">Season Record</h3>
                <p class="mt-2 text-3xl font-extrabold text-green-600">{{ seasonCorrect }}-{{ seasonWrong }}</p>
                <p class="mt-1 text-gray-500">{{ seasonPercentage }}% correct</p>
              </div>
              
              <div class="card p-6 text-center">
                <h3 class="text-lg font-medium text-gray-900">Current Rank</h3>
                <p class="mt-2 text-3xl font-extrabold text-purple-600">#{{ currentRank || '-' }}</p>
                <p class="mt-1 text-gray-500">This week</p>
              </div>

              <div class="card p-6 text-center">
                <h3 class="text-lg font-medium text-gray-900">Total Points</h3>
                <p class="mt-2 text-3xl font-extrabold text-orange-600">{{ totalPoints }}</p>
                <p class="mt-1 text-gray-500">Season total</p>
              </div>
            </div>

            <!-- Quick Actions -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button (click)="router.navigate(['/picks'])" class="card p-6 text-center hover:shadow-lg transition-shadow cursor-pointer">
                <div class="text-3xl mb-2">🏈</div>
                <h4 class="font-medium">{{ hasAllPicks ? 'View Picks' : 'Make Picks' }}</h4>
                <p class="text-sm text-gray-600 mt-1">
                  {{ hasAllPicks ? 'Review your selections' : 'Pick winners for this week' }}
                </p>
              </button>
              
              <button (click)="router.navigate(['/leaderboard'])" class="card p-4 text-center hover:shadow-lg transition-shadow cursor-pointer">
                <div class="text-3xl mb-2">🏆</div>
                <h4 class="font-medium">Leaderboard</h4>
                <p class="text-sm text-gray-600 mt-1">See rankings and standings</p>
              </button>
              
              <button (click)="router.navigate(['/results'])" class="card p-4 text-center hover:shadow-lg transition-shadow cursor-pointer">
                <div class="text-3xl mb-2">📊</div>
                <h4 class="font-medium">Results</h4>
                <p class="text-sm text-gray-600 mt-1">View game outcomes</p>
              </button>
              
              <button (click)="router.navigate(['/profile'])" class="card p-4 text-center hover:shadow-lg transition-shadow cursor-pointer">
                <div class="text-3xl mb-2">👤</div>
                <h4 class="font-medium">Profile Settings</h4>
                <p class="text-sm text-gray-600 mt-1">Change password & settings</p>
              </button>
              
              <button *ngIf="currentUser?.isAdmin" (click)="router.navigate(['/admin'])" class="card p-4 text-center hover:shadow-lg transition-shadow cursor-pointer">
                <div class="text-3xl mb-2">⚙️</div>
                <h4 class="font-medium">Admin Panel</h4>
                <p class="text-sm text-gray-600 mt-1">Manage users and settings</p>
              </button>
            </div>

            <!-- This Week's Games Preview -->
            <div class="card">
              <div class="p-6 border-b">
                <div class="flex justify-between items-center">
                  <h3 class="text-lg font-semibold">Week {{ currentWeek }} Games</h3>
                  <span class="text-sm text-gray-600">{{ completedGamesCount }}/{{ totalGames }} completed</span>
                </div>
              </div>
              
              <div class="p-6">
                <div class="space-y-3">
                  <!-- Show upcoming games first -->
                  <div *ngFor="let game of upcomingGames.slice(0, 3)" 
                       class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center space-x-3">
                      <div class="flex items-center space-x-2">
                        <img [src]="getTeamLogo(game.visitorTeam?.abbreviation || '')" 
                             [alt]="game.visitorTeam?.name || 'Visitor Team'" 
                             class="w-6 h-6 object-contain"
                             (error)="handleImageError($event, game.visitorTeam?.abbreviation || '')"
                             loading="lazy">
                        <span class="font-medium">{{ game.visitorTeam?.name || 'Unknown' }}</span>
                      </div>
                      <span class="text-gray-400">&#64;</span>
                      <div class="flex items-center space-x-2">
                        <img [src]="getTeamLogo(game.homeTeam?.abbreviation || '')" 
                             [alt]="game.homeTeam?.name || 'Home Team'" 
                             class="w-6 h-6 object-contain"
                             (error)="handleImageError($event, game.homeTeam?.abbreviation || '')"
                             loading="lazy">
                        <span class="font-medium">{{ game.homeTeam?.name || 'Unknown' }}</span>
                      </div>
                      <div *ngIf="game.isMonday" class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">MNF</div>
                    </div>
                    <div class="flex items-center space-x-2">
                      <span class="text-sm text-gray-600">{{ formatGameTime(game.date) }}</span>
                      <span [class]="getPickStatusClass(game.id)">{{ getPickStatus(game.id) }}</span>
                    </div>
                  </div>
                  
                  <!-- If no upcoming games, show recent completed games -->
                  <div *ngIf="upcomingGames.length === 0" class="space-y-3">
                    <div class="text-center text-sm text-gray-600 mb-3">All games completed - Recent results:</div>
                    <div *ngFor="let game of completedGames.slice(-3)" 
                         class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div class="flex items-center space-x-3">
                        <div class="flex items-center space-x-2">
                          <img [src]="getTeamLogo(game.visitorTeam?.abbreviation || '')" 
                               [alt]="game.visitorTeam?.name || 'Visitor Team'" 
                               class="w-6 h-6 object-contain"
                               (error)="handleImageError($event, game.visitorTeam?.abbreviation || '')"
                               loading="lazy">
                          <span class="font-medium">{{ game.visitorTeam?.name || 'Unknown' }}</span>
                          <span class="text-sm font-mono">{{ game.visitorTeam?.score || 0 }}</span>
                        </div>
                        <span class="text-gray-400">&#64;</span>
                        <div class="flex items-center space-x-2">
                          <img [src]="getTeamLogo(game.homeTeam?.abbreviation || '')" 
                               [alt]="game.homeTeam?.name || 'Home Team'" 
                               class="w-6 h-6 object-contain"
                               (error)="handleImageError($event, game.homeTeam?.abbreviation || '')"
                               loading="lazy">
                          <span class="font-medium">{{ game.homeTeam?.name || 'Unknown' }}</span>
                          <span class="text-sm font-mono">{{ game.homeTeam?.score || 0 }}</span>
                        </div>
                        <div *ngIf="game.isMonday" class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">MNF</div>
                      </div>
                      <div class="flex items-center space-x-2">
                        <span class="text-sm text-gray-600">Final</span>
                        <span [class]="getPickStatusClass(game.id)">{{ getPickResult(game.id) }}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div *ngIf="upcomingGames.length === 0 && completedGames.length === 0" class="text-center py-4 text-gray-500">
                    No games available for this week
                  </div>
                  
                  <div *ngIf="upcomingGames.length > 3" class="text-center pt-2">
                    <button (click)="router.navigate(['/picks'])" class="text-blue-600 hover:text-blue-800 text-sm">
                      View all {{ upcomingGames.length }} games →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Recent Results -->
              <div class="card">
                <div class="p-6 border-b">
                  <div class="flex justify-between items-center">
                    <h3 class="text-lg font-semibold">Recent Results</h3>
                    <button (click)="router.navigate(['/results'])" class="text-blue-600 hover:text-blue-800 text-sm">
                      View All →
                    </button>
                  </div>
                </div>
                
                <div class="p-6">
                  <div class="space-y-3">
                    <div *ngFor="let game of completedGames.slice(0, 4)" 
                         class="flex items-center justify-between">
                      <div class="text-sm">{{ game.visitorTeam.name }} &#64; {{ game.homeTeam.name }}</div>
                      <div class="text-right">
                        <div class="text-sm font-medium">
                          {{ game.visitorTeam.score || 0 }} - {{ game.homeTeam.score || 0 }}
                        </div>
                        <div [class]="getResultClass(game.id)">{{ getPickResult(game.id) }}</div>
                      </div>
                    </div>
                    
                    <div *ngIf="completedGames.length === 0" class="text-center py-4 text-gray-500">
                      No completed games yet this week
                    </div>
                  </div>
                </div>
              </div>

              <!-- Top 5 Leaderboard -->
              <div class="card">
                <div class="p-6 border-b">
                  <div class="flex justify-between items-center">
                    <h3 class="text-lg font-semibold">Week {{ currentWeek }} Leaders</h3>
                    <button (click)="router.navigate(['/leaderboard'])" class="text-blue-600 hover:text-blue-800 text-sm">
                      View Full →
                    </button>
                  </div>
                </div>
                
                <div class="p-6">
                  <div class="space-y-3">
                    <div *ngFor="let entry of topPlayers; let i = index" 
                         class="flex items-center justify-between"
                         [class]="entry.userId === currentUser?.id ? 'bg-blue-50 -mx-3 px-3 py-2 rounded' : ''">
                      <div class="flex items-center space-x-3">
                        <div class="text-lg">
                          <span *ngIf="i === 0 && getWeekWinner(currentWeek)?.userId === entry.userId" class="text-yellow-500">🏆</span>
                          {{ i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) }}
                        </div>
                        <div>
                          <div class="font-medium">
                            {{ entry.firstName }} {{ entry.lastName }}
                            <span *ngIf="entry.userId === currentUser?.id" class="text-blue-600 text-sm">(You)</span>
                            <span *ngIf="i === 0 && getWeekWinner(currentWeek)?.userId === entry.userId" class="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">WINNER</span>
                            <span *ngIf="hasWeeklyTiebreaker(currentWeek) && i === 0" class="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">Tiebreaker Used</span>
                          </div>
                          <div class="text-xs text-gray-500">{{ entry.correctPicks }}/{{ entry.totalPicks }} correct</div>
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="font-bold">{{ entry.totalPoints }}</div>
                        <div class="text-xs text-gray-500">points</div>
                      </div>
                    </div>
                    
                    <div *ngIf="topPlayers.length === 0" class="text-center py-4 text-gray-500">
                      No rankings available yet
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
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  public router = inject(Router);
  private gameService = inject(GameService);
  private pickService = inject(PickService);
  private leaderboardService = inject(LeaderboardService);
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  loading = true;
  error = '';

  currentWeek = 1;
  currentSeason = new Date().getFullYear();

  // Stats
  currentWeekPicks = 0;
  seasonCorrect = 0;
  seasonWrong = 0;
  currentRank = 0;
  totalPoints = 0;

  // Games and picks
  upcomingGames: Game[] = [];
  completedGames: Game[] = [];
  userPicks: Pick[] = [];
  topPlayers: LeaderboardEntry[] = [];
  weeklyWinners: any[] = [];

  get currentUser() {
    return this.authService.currentUser;
  }

  get totalGames(): number {
    return this.upcomingGames.length + this.completedGames.length;
  }

  get completedGamesCount(): number {
    return this.completedGames.length;
  }

  get hasAllPicks(): boolean {
    return this.currentWeekPicks >= this.upcomingGames.length;
  }

  get seasonPercentage(): string {
    const total = this.seasonCorrect + this.seasonWrong;
    return total > 0 ? ((this.seasonCorrect / total) * 100).toFixed(1) : '0.0';
  }

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.loading = true;
    this.error = '';

    // Load current week games for display (switches to next week on Wednesday)
    this.gameService.getCurrentWeekGamesForDisplay().subscribe({
      next: (response: GamesResponse) => {
        this.currentWeek = response.week;
        this.currentSeason = response.season;
        this.upcomingGames = response.games.filter(g => g.status === 'scheduled');
        this.completedGames = response.games.filter(g => g.status === 'final');

        console.log('Dashboard loaded:', {
          week: this.currentWeek,
          season: this.currentSeason,
          total: response.games.length,
          upcoming: this.upcomingGames.length,
          completed: this.completedGames.length
        });

        // Add small delay before next request to avoid overwhelming the API
        setTimeout(() => {
          this.loadUserPicks();
        }, 300);

        setTimeout(() => {
          this.loadLeaderboard();
        }, 600);
      },
      error: (error: any) => {
        console.error('Error loading games:', error);
        this.error = 'Failed to load dashboard data. Please try refreshing the page.';
        this.loading = false;
      }
    });
  }

  loadUserPicks() {
    if (!this.currentUser) return;

    this.pickService.getUserPicks(this.currentWeek, this.currentSeason).subscribe({
      next: (response: PicksResponse) => {
        this.userPicks = response.picks;
        this.currentWeekPicks = this.userPicks.length;
        this.calculateStats();
      },
      error: (error: any) => {
        console.error('Error loading user picks:', error);
        // Don't set loading to false here, let leaderboard complete
      }
    });
  }

  loadLeaderboard() {
    this.leaderboardService.getWeeklyLeaderboard(this.currentWeek, this.currentSeason).subscribe({
      next: (response) => {
        this.topPlayers = response.leaderboard.slice(0, 5);
        if (this.currentUser) {
          const userEntry = response.leaderboard.find(entry => entry.userId === this.currentUser!.id);
          this.currentRank = userEntry?.rank || 0;
          this.totalPoints = userEntry?.totalPoints || 0;
        }
        this.loadWeeklyWinners();
      },
      error: (error: any) => {
        console.error('Error loading leaderboard:', error);
        this.loading = false;
      }
    });
  }

  loadWeeklyWinners() {
    this.leaderboardService.getWeeklyWinners(this.currentSeason).subscribe({
      next: (response) => {
        this.weeklyWinners = response.winners;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading weekly winners:', error);
        this.loading = false;
      }
    });
  }

  getWeekWinner(week: number): any {
    return this.weeklyWinners.find(w => w.week === week);
  }

  hasWeeklyTiebreaker(week: number): boolean {
    const winner = this.getWeekWinner(week);
    return winner && winner.tiebreakerUsed;
  }

  calculateStats() {
    // Calculate season stats from picks
    const correctPicks = this.userPicks.filter(pick => pick.isCorrect === true).length;
    const incorrectPicks = this.userPicks.filter(pick => pick.isCorrect === false).length;
    this.seasonCorrect = correctPicks;
    this.seasonWrong = incorrectPicks;
  }

  formatGameTime(gameTime: string): string {
    const date = new Date(gameTime);
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24 && diffHours > 0) {
      return `Today ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  getPickStatus(gameId: number): string {
    const pick = this.userPicks.find(p => p.gameId === gameId);
    return pick ? 'Picked' : 'Pending';
  }

  getPickStatusClass(gameId: number): string {
    const pick = this.userPicks.find(p => p.gameId === gameId);
    return pick
      ? 'px-2 py-1 bg-green-100 text-green-800 rounded text-xs'
      : 'px-2 py-1 bg-red-100 text-red-800 rounded text-xs';
  }

  getPickResult(gameId: number): string {
    const pick = this.userPicks.find(p => p.gameId === gameId);
    if (!pick) return 'No Pick';
    if (pick.isCorrect === null) return 'Pending';
    return pick.isCorrect ? '✓ Correct' : '✗ Wrong';
  }

  getResultClass(gameId: number): string {
    const pick = this.userPicks.find(p => p.gameId === gameId);
    if (!pick || pick.isCorrect === null) return 'text-gray-500 text-xs';
    return pick.isCorrect
      ? 'text-green-600 text-xs font-medium'
      : 'text-red-600 text-xs font-medium';
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth']);
  }

  getTeamLogo(abbreviation: string): string {
    if (!abbreviation) return '';
    // Simply return the server-side logo endpoint
    return `${this.baseUrl}/team-logos/${abbreviation?.toLowerCase()}_logo.png`;
  }

  handleImageError(event: Event, teamAbbreviation: string): void {
    const imgElement = event.target as HTMLImageElement;
    console.log(`Logo failed to load for ${teamAbbreviation}, falling back to ESPN`);
    // Fallback to ESPN logo if server logo fails
    imgElement.src = `https://a.espncdn.com/i/teamlogos/nfl/500/${teamAbbreviation?.toUpperCase()}.png`;

    // If ESPN also fails, show a placeholder
    imgElement.onerror = () => {
      imgElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNiA4QzEyLjY4NjMgOCAxMCAxMC42ODYzIDEwIDE0QzEwIDE3LjMxMzcgMTIuNjg2MyAyMCAxNiAyMEMxOS4zMTM3IDIwIDIyIDE3LjMxMzcgMjIgMTRDMjIgMTAuNjg2MyAxOS4zMTM3IDggMTYgOFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+Cg==';
      imgElement.onerror = null; // Prevent infinite loop
    };
  }

  private loadTeamLogos(): void {
    // No longer needed - server handles everything
    // Keep method for backward compatibility but it's now a no-op
  }
}
