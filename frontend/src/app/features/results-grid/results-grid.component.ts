import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { GameService } from '../../core/services/game.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NavigationComponent } from '../../shared/components/navigation.component';

@Component({
  selector: 'app-results-grid',
  standalone: true,
  imports: [CommonModule, FormsModule, NavigationComponent],
  template: `
    <div class="h-screen bg-gray-50 flex flex-col">
      <app-navigation title="Score Grid" subtitle="Users vs Games — green = correct, red = incorrect"></app-navigation>

      <!-- Controls section - fixed height -->
      <div class="flex-shrink-0 px-6 py-4 bg-white border-b">
        <div class="flex items-center space-x-4">
          <label class="text-sm font-medium text-gray-700">Week:</label>
          <select [(ngModel)]="selectedWeek" (ngModelChange)="loadGrid()" class="input-field">
            <option *ngFor="let w of availableWeeks" [value]="w">Week {{ w }}</option>
          </select>
          <div class="text-sm text-gray-500">Season: {{ currentSeason }}</div>
        </div>
      </div>

      <!-- Main content area - takes remaining height -->
      <div class="flex-1 overflow-hidden">
        <div *ngIf="loading" class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">Loading grid...</p>
          </div>
        </div>

        <!-- Full grid: users x games - scrollable viewport -->
        <div *ngIf="!loading && users.length && games.length" class="h-full overflow-auto bg-white">
          <table class="min-w-full table-fixed">
            <thead>
              <tr class="bg-gray-100 sticky top-0 z-20">
                <th class="sticky left-0 z-30 bg-gray-100 p-4 text-left w-56 border-r border-gray-200 shadow-r">
                  <div class="font-semibold text-gray-900">Player</div>
                  <div class="text-xs text-gray-500 mt-1">Pick Status</div>
                </th>
                <th *ngFor="let g of games" class="p-1 text-center bg-gray-100" style="min-width: 120px;">
                  <div class="flex flex-col items-center text-xs">
                    <!-- Visitor Team (Away) -->
                    <div class="flex items-center space-x-1 mb-1">
                      <img [src]="getTeamLogo(g.visitorTeam?.abbreviation)" 
                           [alt]="g.visitorTeam?.abbreviation" 
                           class="w-8 h-8 object-contain"
                           (error)="handleImageError($event, g.visitorTeam?.abbreviation!)"
                           loading="lazy">
                      <span class="font-semibold text-sm">{{ getDisplayScore(g.visitorTeam?.score, g.status) }}</span>
                    </div>
                    <div class="text-gray-400 text-xs">&#64;</div>
                    <!-- Home Team -->  
                    <div class="flex items-center space-x-1 mt-1">
                      <img [src]="getTeamLogo(g.homeTeam?.abbreviation)" 
                           [alt]="g.homeTeam?.abbreviation" 
                           class="w-8 h-8 object-contain"
                           (error)="handleImageError($event, g.homeTeam?.abbreviation!)"
                           loading="lazy">
                      <span class="font-semibold text-sm">{{ getDisplayScore(g.homeTeam?.score, g.status) }}</span>
                    </div>
                    <!-- Game Status Indicator -->
                    <div *ngIf="g.status === 'final'" class="text-green-600 text-xs mt-1">F</div>
                    <div *ngIf="g.status === 'live' || g.status === 'in_progress'" class="text-blue-600 text-xs mt-1">LIVE</div>
                    
                    <!-- Live Quarter and Time Information -->
                    <div *ngIf="(g.status === 'live' || g.status === 'in_progress') && g.liveStatus" 
                         class="text-xs mt-1 font-semibold"
                         [class]="formatLiveStatus(g.liveStatus) === 'HALF' ? 'text-purple-600' : 'text-orange-600'">
                      {{ formatLiveStatus(g.liveStatus) }}
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of users" class="border-t hover:bg-gray-50">
                <td class="sticky left-0 z-10 bg-white hover:bg-gray-50 p-4 border-r border-gray-200 shadow-r">
                  <div class="flex flex-col">
                    <div class="font-semibold text-gray-900">
                      {{ u.firstName }} {{ u.lastName }}
                    </div>
                    <div class="flex items-center space-x-2 mt-1">
                      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                            [class]="getUserPickCount(u.id) === games.length 
                              ? 'bg-green-100 text-green-800' 
                              : getUserPickCount(u.id) === 0 
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                        </svg>
                        {{ getUserPickCount(u.id) }}/{{ games.length }} picks
                      </span>
                      
                      <!-- Tiebreaker Badge -->
                      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                            [class]="hasUserTiebreaker(u.id) 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path *ngIf="hasUserTiebreaker(u.id)" fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                          <path *ngIf="!hasUserTiebreaker(u.id)" fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L9.586 10 5.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                        {{ hasUserTiebreaker(u.id) ? 'MNF' : 'No MNF' }}
                      </span>
                      
                      <span *ngIf="getUserPickCount(u.id) < games.length" 
                            class="text-xs text-red-600 font-medium">
                        {{ games.length - getUserPickCount(u.id) }} missing
                      </span>
                    </div>
                  </div>
                </td>
                <td *ngFor="let g of games" class="p-2 text-center relative">
                  <ng-container *ngIf="picksMap[u.id] && picksMap[u.id][g.id] as pick">
                    <!-- Game finished: show result (✓/✕) -->
                    <div *ngIf="g.status === 'final'" class="flex flex-col items-center space-y-1">
                      <span *ngIf="isPickCorrect(pick, g)" class="text-green-600 font-bold text-lg">✓</span>
                      <span *ngIf="!isPickCorrect(pick, g)" class="text-red-600 font-bold text-lg">✕</span>
                      <!-- Show picked team logo small below result for reference -->
                      <img *ngIf="pick.selectedTeam?.abbreviation" 
                           [src]="getTeamLogo(pick.selectedTeam.abbreviation)" 
                           [alt]="pick.selectedTeam.abbreviation" 
                           class="w-5 h-5 object-contain opacity-70"
                           (error)="handleImageError($event, pick.selectedTeam.abbreviation)"
                           loading="lazy">
                      <!-- Show MNF prediction for finished games too -->
                      <div *ngIf="isTiebreaker(pick) && pick.mondayNightPrediction" 
                           class="text-xs font-bold text-purple-600 bg-purple-50 px-1 py-0.5 rounded">
                        {{ pick.mondayNightPrediction }}
                      </div>
                    </div>
                    
                    <!-- Game started but not finished: show pick details -->
                    <div *ngIf="g.status !== 'final' && gameHasStarted(g)" class="flex flex-col items-center space-y-1">
                      <!-- Show picked team logo -->
                      <img *ngIf="pick.selectedTeam?.abbreviation" 
                           [src]="getTeamLogo(pick.selectedTeam.abbreviation)" 
                           [alt]="pick.selectedTeam.abbreviation" 
                           class="w-8 h-8 object-contain"
                           (error)="handleImageError($event, pick.selectedTeam.abbreviation)"
                           loading="lazy">
                      <!-- Show MNF prediction if applicable -->
                      <div *ngIf="isTiebreaker(pick) && pick.mondayNightPrediction" 
                           class="text-xs font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded">
                        {{ pick.mondayNightPrediction }}
                      </div>
                    </div>
                    
                    <!-- Game not started: show placeholder -->
                    <span *ngIf="g.status !== 'final' && !gameHasStarted(g)" class="text-gray-500">—</span>
                  </ng-container>
                  <ng-container *ngIf="!picksMap[u.id] || !picksMap[u.id][g.id]">
                    <span class="text-gray-400">—</span>
                  </ng-container>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Fallback: if users not available but games exist, show games-only results -->
        <div *ngIf="!loading && (!users.length) && games.length" class="h-full overflow-auto p-6">
          <div class="text-center text-gray-600 mb-6">Full user grid unavailable (admin only). Showing games for the selected week.</div>
          <div class="card">
            <div class="p-6">
              <div *ngFor="let game of games" class="py-3 border-b">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-4">
                    <img [src]="getTeamLogo(game.visitorTeam.abbreviation)" 
                         class="w-8 h-8 object-contain"
                         (error)="handleImageError($event, game.visitorTeam.abbreviation)"
                         loading="lazy"/>
                    <div>
                      <div class="font-semibold">{{ game.visitorTeam.name }} ({{ game.visitorTeam.score ?? '-' }})</div>
                      <div class="text-sm text-gray-500">at {{ game.homeTeam.abbreviation }}</div>
                    </div>
                    <div class="text-gray-400">vs</div>
                    <img [src]="getTeamLogo(game.homeTeam.abbreviation)" 
                         class="w-8 h-8 object-contain"
                         (error)="handleImageError($event, game.homeTeam.abbreviation)"
                         loading="lazy"/>
                    <div>
                      <div class="font-semibold">{{ game.homeTeam.name }} ({{ game.homeTeam.score ?? '-' }})</div>
                    </div>
                  </div>
                  <div class="text-sm text-gray-600">{{ formatGameTime(game.date) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="!loading && (!games.length)" class="flex items-center justify-center h-full text-gray-600">
          No games available for the selected week.
        </div>
      </div>
    </div>
  `,
  styles: [`
    .shadow-r {
      box-shadow: 2px 0 4px -2px rgba(0, 0, 0, 0.1);
    }
    
    /* Ensure sticky headers work correctly */
    thead tr th:first-child {
      position: sticky;
      left: 0;
      z-index: 30;
    }
    
    tbody tr td:first-child {
      position: sticky;
      left: 0;
      z-index: 10;
    }
    
    /* Smooth scrolling */
    .overflow-auto {
      scroll-behavior: smooth;
    }
  `]
})
export class ResultsGridComponent implements OnInit {
  private adminService = inject(AdminService);
  private gameService = inject(GameService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;


  loading = false;
  error = '';
  users: any[] = [];
  games: any[] = [];
  picksMap: Record<number, Record<number, any>> = {};

  currentSeason!: number;
  selectedWeek = 1;
  availableWeeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

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
    
    console.log('ResultsGrid: Current date:', now.toISOString());
    console.log('ResultsGrid: Calculated NFL season:', this.currentSeason);

    (async () => {
      try {
        if (this.authService.isAuthenticated && !this.authService.currentUser) {
          await firstValueFrom(this.authService.getProfile());
        }
      } catch (e) {
        console.warn('ResultsGrid: profile fetch failed (continuing with fallback)', e);
      } finally {
        // Load current week first, then load the grid
        await this.loadCurrentWeek();
        this.loadGrid();
      }
    })();
  }

  async loadCurrentWeek() {
    try {
      // Use getCurrentWeekGamesForDisplay to get the week that switches on Wednesday
      const response = await firstValueFrom(this.gameService.getCurrentWeekGamesForDisplay());
      if (response.week > 0) {
        this.selectedWeek = response.week;
      }
    } catch (error) {
      console.warn('Failed to get current week, using default week 1', error);
      // Keep default selectedWeek = 1
    }
  }

  async loadGrid() {
    this.loading = true;
    this.users = [];
    this.games = [];
    this.picksMap = {};

    try {
      this.error = '';
      // Always attempt to load games first
      try {
        if (this.authService.isAuthenticated) {
          const gamesRes: any = await firstValueFrom(this.gameService.getWeekGames(this.currentSeason, this.selectedWeek));
          this.games = gamesRes.games || [];
        } else {
          // Public fallback to live games (current week only)
          const liveRes: any = await firstValueFrom(this.gameService.getLiveGames());
          if (liveRes.week === this.selectedWeek && liveRes.season === this.currentSeason) {
            this.games = liveRes.games || [];
          }
        }
      } catch (gameErr) {
        console.warn('ResultsGrid: failed to fetch games via auth endpoint, trying live fallback', gameErr);
        try {
          const liveRes: any = await firstValueFrom(this.gameService.getLiveGames());
          if (liveRes.week === this.selectedWeek && liveRes.season === this.currentSeason) {
            this.games = liveRes.games || [];
          }
        } catch (liveErr) {
          console.error('ResultsGrid: live fallback failed', liveErr);
        }
      }

      // If user is admin, load users and picks
      if (this.authService.isAuthenticated && this.authService.isAdmin) {
        const usersRes: any = await firstValueFrom(this.adminService.getAllUsers());
        this.users = usersRes.users || [];

        const picksRes: any = await firstValueFrom(this.adminService.getAllPicks(this.selectedWeek, this.currentSeason));
        const picks = picksRes.picks || [];
        picks.forEach((p: any) => {
          if (!this.picksMap[p.userId]) this.picksMap[p.userId] = {};
          this.picksMap[p.userId][p.gameId] = p;
        });
      }

      if (!this.games.length) {
        this.error = 'No games found for the selected week.';
      }
      if (this.authService.isAdmin && !this.users.length) {
        // Only show this if admin expected data
        this.error = this.error ? this.error + ' No users data returned.' : 'No users data returned.';
      }
    } catch (err: any) {
      console.error('Error loading grid:', err);
      if (err?.status === 401) {
        this.error = 'Unauthorized. Please log in again.';
      } else if (err?.status === 403) {
        this.error = 'Forbidden. Admin privileges are required to view this page.';
      } else {
        this.error = 'Failed to load grid. Check network or server status.';
      }
    } finally {
      this.loading = false;
    }
  }

  isPickCorrect(pick: any, game: any): boolean {
    if (!pick || !game) return false;
    // Determine actual winner
    const homeScore = game.homeTeam?.score ?? null;
    const visitorScore = game.visitorTeam?.score ?? null;
    if (homeScore === null || visitorScore === null) return false;

    const winningTeamId = homeScore > visitorScore ? game.homeTeam.id : (visitorScore > homeScore ? game.visitorTeam.id : null);
    return pick.selectedTeamId === winningTeamId;
  }

  getUserPickCount(userId: number): number {
    if (!this.picksMap[userId]) return 0;
    return Object.keys(this.picksMap[userId]).length;
  }

  getDisplayScore(score: number | null | undefined, gameStatus: string): string {
    // For completed games and live games, show the actual score (including 0)
    if ((gameStatus === 'final' || gameStatus === 'live' || gameStatus === 'in_progress') && score !== null && score !== undefined) {
      return score.toString();
    }
    // For scheduled games or missing scores, show dash
    return '-';
  }

  hasUserTiebreaker(userId: number): boolean {
    if (!this.picksMap[userId]) return false;

    // Find Tiebreaker Game pick for this user
    const userPicks = this.picksMap[userId];
    for (const gameId in userPicks) {
      const pick = userPicks[gameId];
      if (this.isTiebreaker(pick) && pick.mondayNightPrediction) {
        return true;
      }
    }
    return false;
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

  handleImageError(event: Event, teamAbbreviation: string): void {
    const imgElement = event.target as HTMLImageElement;
    // Fallback to ESPN logo if server logo fails
    imgElement.src = `https://a.espncdn.com/i/teamlogos/nfl/500/${teamAbbreviation?.toUpperCase()}.png`;
  }

  gameHasStarted(game: any): boolean {
    if (!game || !game.date) return false;

    // If game is live or in progress, it has definitely started
    if (game.status === 'live' || game.status === 'in_progress') {
      return true;
    }

    // Check if current time is past the game start time
    const gameStartTime = new Date(game.date);
    const now = new Date();

    return now >= gameStartTime;
  }

  isTiebreaker(pick: any): boolean {
    // Check if this pick is for a tiebreaker game (last game of the week)
    return pick.game?.isTiebreaker === 1 || pick.game?.isTiebreaker === true;
  }

  formatLiveStatus(liveStatus: string): string {
    if (!liveStatus) return '';

    // Check for halftime (handle various formats)
    const statusLower = liveStatus.toLowerCase();
    if (statusLower.includes('halftime') || statusLower.includes('half time') || statusLower === 'half') {
      return 'HALF';
    }

    // Expected format: "3:45 - 4th" -> want "4th 3:45"
    const match = liveStatus.match(/^(\d{1,2}:\d{2})\s*-\s*(\d+)(?:st|nd|rd|th)$/);
    if (match) {
      const time = match[1];
      const quarter = match[2];
      return `${this.ordinalSuffix(quarter)} ${time}`;
    }

    // Fallback: return as-is
    return liveStatus;
  }

  private ordinalSuffix(num: string): string {
    const n = parseInt(num);
    const suffix = ['th', 'st', 'nd', 'rd'][n % 10 > 3 || Math.floor(n % 100 / 10) === 1 ? 0 : n % 10];
    return `${n}${suffix}`;
  }
}
