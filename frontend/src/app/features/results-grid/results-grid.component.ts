import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { GameService } from '../../core/services/game.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-results-grid',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <div class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="py-6">
            <h1 class="text-3xl font-bold text-gray-900">Score Grid</h1>
            <p class="mt-1 text-sm text-gray-500">Users vs Games — green = correct, red = incorrect</p>
          </div>
        </div>
      </div>

      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
          <div class="mb-4 flex items-center space-x-4">
            <label class="text-sm font-medium text-gray-700">Week:</label>
            <select [(ngModel)]="selectedWeek" (ngModelChange)="loadGrid()" class="input-field">
              <option *ngFor="let w of availableWeeks" [value]="w">Week {{ w }}</option>
            </select>
            <div class="text-sm text-gray-500">Season: {{ currentSeason }}</div>
          </div>

          <div *ngIf="loading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">Loading grid...</p>
          </div>

          <!-- Full grid: users x games -->
          <div *ngIf="!loading && users.length && games.length" class="overflow-auto border rounded-lg bg-white">
            <table class="min-w-full table-fixed">
              <thead class="bg-gray-100">
                <tr>
                  <th class="p-3 text-left w-48">User</th>
                  <th *ngFor="let g of games" class="p-1 text-center" style="min-width: 120px;">
                    <div class="flex flex-col items-center text-xs">
                      <!-- Visitor Team (Away) -->
                      <div class="flex items-center space-x-1 mb-1">
                        <img [src]="getTeamLogo(g.visitorTeam?.abbreviation)" 
                             [alt]="g.visitorTeam?.abbreviation" 
                             class="w-8 h-8 object-contain"
                             (error)="handleImageError($event, g.visitorTeam?.abbreviation!)"
                             loading="lazy">
                        <span class="font-semibold text-sm">{{ g.visitorTeam?.score || '-' }}</span>
                      </div>
                      <div class="text-gray-400 text-xs">&#64;</div>
                      <!-- Home Team -->  
                      <div class="flex items-center space-x-1 mt-1">
                        <img [src]="getTeamLogo(g.homeTeam?.abbreviation)" 
                             [alt]="g.homeTeam?.abbreviation" 
                             class="w-8 h-8 object-contain"
                             (error)="handleImageError($event, g.homeTeam?.abbreviation!)"
                             loading="lazy">
                        <span class="font-semibold text-sm">{{ g.homeTeam?.score || '-' }}</span>
                      </div>
                      <!-- Game Status Indicator -->
                      <div *ngIf="g.status === 'final'" class="text-green-600 text-xs mt-1">F</div>
                      <div *ngIf="g.status === 'in_progress'" class="text-blue-600 text-xs mt-1">LIVE</div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let u of users" class="border-t">
                  <td class="p-2">{{ u.firstName }} {{ u.lastName }}</td>
                  <td *ngFor="let g of games" class="p-2 text-center">
                    <ng-container *ngIf="picksMap[u.id] && picksMap[u.id][g.id] as pick">
                      <span *ngIf="g.status === 'final'">
                        <span *ngIf="isPickCorrect(pick, g)" class="text-green-600 font-bold">✓</span>
                        <span *ngIf="!isPickCorrect(pick, g)" class="text-red-600 font-bold">✕</span>
                      </span>
                      <span *ngIf="g.status !== 'final'" class="text-gray-500">—</span>
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
          <div *ngIf="!loading && (!users.length) && games.length" class="space-y-6">
            <div class="text-center text-gray-600">Full user grid unavailable (admin only). Showing games for the selected week.</div>
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

          <div *ngIf="!loading && (!games.length)" class="text-center py-8 text-gray-600">
            No games available for the selected week.
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
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

  currentSeason = new Date().getFullYear();
  selectedWeek = 1;
  availableWeeks = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18];

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
    (async () => {
      try {
        if (this.authService.isAuthenticated && !this.authService.currentUser) {
          await firstValueFrom(this.authService.getProfile());
        }
      } catch (e) {
        console.warn('ResultsGrid: profile fetch failed (continuing with fallback)', e);
      } finally {
        this.loadGrid();
      }
    })();
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
}
