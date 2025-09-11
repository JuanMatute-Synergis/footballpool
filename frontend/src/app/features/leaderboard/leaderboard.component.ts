import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { GameService } from '../../core/services/game.service';
import { LeaderboardEntry, WeeklyWinner } from '../../core/models/leaderboard.model';
import { NavigationComponent } from '../../shared/components/navigation.component';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NavigationComponent],
  template: `
    <div class="h-screen bg-gray-50 flex flex-col">
      <!-- Navigation -->
      <app-navigation 
        title="Leaderboards" 
        subtitle="Track your progress and compete with others">
      </app-navigation>

      <!-- Tabs section - fixed height -->
      <div class="flex-shrink-0 bg-white border-b">
        <div class="max-w-7xl mx-auto px-6">
          <nav class="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
            <button 
              (click)="setActiveTab('weekly')"
              [class]="activeTab === 'weekly' 
                ? 'border-blue-500 text-blue-600 py-4 px-4 border-b-2 font-medium text-sm focus:outline-none whitespace-nowrap' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-4 px-4 border-b-2 font-medium text-sm focus:outline-none whitespace-nowrap'">
              Weekly
            </button>
            <button 
              (click)="setActiveTab('season')"
              [class]="activeTab === 'season' 
                ? 'border-blue-500 text-blue-600 py-4 px-4 border-b-2 font-medium text-sm focus:outline-none whitespace-nowrap' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-4 px-4 border-b-2 font-medium text-sm focus:outline-none whitespace-nowrap'">
              Season
            </button>
            <button 
              (click)="setActiveTab('winners')"
              [class]="activeTab === 'winners' 
                ? 'border-blue-500 text-blue-600 py-4 px-4 border-b-2 font-medium text-sm focus:outline-none whitespace-nowrap' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-4 px-4 border-b-2 font-medium text-sm focus:outline-none whitespace-nowrap'">
              Winners
            </button>
          </nav>
        </div>
      </div>

      <!-- Main content area - takes remaining height -->
      <div class="flex-1 overflow-hidden">
        <!-- Loading -->
        <div *ngIf="loading" class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">Loading...</p>
          </div>
        </div>

        <!-- Error -->
        <div *ngIf="error" class="flex items-center justify-center h-full p-6">
          <div class="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <p class="text-red-800">{{ error }}</p>
            <button (click)="loadData()" class="mt-4 btn-primary">Try Again</button>
          </div>
        </div>

        <!-- Weekly Tab -->
        <div *ngIf="activeTab === 'weekly' && !loading && !error" class="h-full flex flex-col">
          <!-- Controls section -->
          <div class="flex-shrink-0 px-6 py-4 bg-white border-b">
            <div class="flex flex-col space-y-3 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
              <h2 class="text-lg font-semibold">Week {{ currentWeek }} Leaderboard</h2>
              <div class="flex space-x-2">
                <select [(ngModel)]="selectedWeek" (ngModelChange)="loadWeeklyLeaderboard()" class="input-field text-sm">
                  <option *ngFor="let w of availableWeeks" [value]="w">Week {{ w }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Scrollable table content -->
          <div class="flex-1 overflow-auto bg-white">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr class="bg-gray-50 sticky top-0 z-10">
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">Rank</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">Player</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">Correct</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">Bonus</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">Total</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">MNF Diff</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr *ngFor="let entry of weeklyLeaderboard; let i = index" 
                    [class]="entry.userId === currentUserId ? 'bg-blue-50' : ''">
                  <td class="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sm:px-6">
                    <div class="flex items-center">
                      <span [class]="getRankClass(entry.rank)">{{ entry.rank }}</span>
                      <div *ngIf="entry.rank === 1" class="ml-2 flex items-center">
                        <span class="text-yellow-500 text-lg">🏆</span>
                        <span *ngIf="hasWeeklyTiebreaker()" class="ml-1 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Tiebreaker Used</span>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-900 sm:px-6">
                    <div class="truncate max-w-32 sm:max-w-none">
                      {{ entry.firstName }} {{ entry.lastName }}
                      <span *ngIf="entry.userId === currentUserId" class="ml-2 text-blue-600 font-medium">(You)</span>
                    </div>
                  </td>
                  <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900 sm:px-6">
                    {{ entry.correctPicks }}/{{ entry.totalPicks }}
                  </td>
                  <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900 sm:px-6">
                    <span *ngIf="entry.bonusPoints" class="text-green-600 font-medium">+{{ entry.bonusPoints }}</span>
                    <span *ngIf="!entry.bonusPoints">-</span>
                  </td>
                  <td class="px-3 py-4 whitespace-nowrap text-sm font-bold text-gray-900 sm:px-6">
                    {{ entry.totalPoints }}
                  </td>
                  <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500 sm:px-6">
                    <span *ngIf="entry.mondayNightDiff !== null">{{ entry.mondayNightDiff }}</span>
                    <span *ngIf="entry.mondayNightDiff === null">-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Season Tab -->
        <div *ngIf="activeTab === 'season' && !loading && !error" class="h-full flex flex-col">
          <!-- Controls section -->
          <div class="flex-shrink-0 px-6 py-4 bg-white border-b">
            <div class="flex justify-between items-center">
              <h2 class="text-lg font-semibold">{{ currentSeason }} Season Leaderboard</h2>
            </div>
          </div>

          <!-- Scrollable table content -->
          <div class="flex-1 overflow-auto bg-white">
            <table class="min-w-full divide-y divide-gray-200">
              <thead>
                <tr class="bg-gray-50 sticky top-0 z-10">
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">Rank</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">Player</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">Weeks</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">Correct</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">Perfect</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">Total Pts</th>
                  <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 bg-gray-50">Avg/Week</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr *ngFor="let entry of seasonLeaderboard" 
                    [class]="entry.userId === currentUserId ? 'bg-blue-50' : ''">
                  <td class="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sm:px-6">
                    <span [class]="getRankClass(entry.rank)">{{ entry.rank }}</span>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-900 sm:px-6">
                    <div class="truncate max-w-32 sm:max-w-none">
                      {{ entry.firstName }} {{ entry.lastName }}
                      <span *ngIf="entry.userId === currentUserId" class="ml-2 text-blue-600 font-medium">(You)</span>
                    </div>
                  </td>
                  <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900 sm:px-6">
                    {{ entry.weeksPlayed }}
                  </td>
                  <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900 sm:px-6">
                    {{ entry.totalCorrectPicks }}/{{ entry.totalPicks }}
                  </td>
                  <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900 sm:px-6">
                    <span *ngIf="entry.perfectWeeks" class="text-green-600 font-medium">{{ entry.perfectWeeks }}</span>
                    <span *ngIf="!entry.perfectWeeks">0</span>
                  </td>
                  <td class="px-3 py-4 whitespace-nowrap text-sm font-bold text-gray-900 sm:px-6">
                    {{ entry.totalPoints }}
                  </td>
                  <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500 sm:px-6">
                    {{ entry.avgWeeklyPoints }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Winners Tab -->
        <div *ngIf="activeTab === 'winners' && !loading && !error" class="h-full overflow-auto p-6">
          <h2 class="text-lg font-semibold mb-6 sticky top-0 bg-gray-50 py-2">Recent Weekly Winners</h2>

          <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div *ngFor="let winner of weeklyWinners" class="card p-4 sm:p-6">
              <div class="flex items-center justify-between mb-4">
                <div class="text-base sm:text-lg font-semibold">Week {{ winner.week }}</div>
                <div class="flex items-center space-x-2">
                  <div class="text-xl sm:text-2xl">🏆</div>
                  <span *ngIf="winner.tieBreakerDiff !== null" class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Tiebreaker</span>
                </div>
              </div>
              <div class="text-lg sm:text-2xl font-bold text-blue-600 mb-2 truncate">
                {{ winner.firstName }} {{ winner.lastName }}
              </div>
              <div class="flex justify-between text-sm text-gray-600 mb-2">
                <span>Points: {{ winner.points }}</span>
                <span *ngIf="winner.isTie" class="text-orange-600 font-medium">TIE</span>
              </div>
              <div *ngIf="winner.tieBreakerDiff !== null" class="text-xs text-gray-500">
                <span class="font-medium">MNF Tiebreaker:</span> {{ winner.tieBreakerDiff }} point difference
              </div>
            </div>
          </div>

          <div *ngIf="weeklyWinners.length === 0" class="text-center py-8 text-gray-500">
            No weekly winners yet. Be the first!
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Smooth scrolling */
    .overflow-auto {
      scroll-behavior: smooth;
    }
    
    /* Ensure sticky headers work correctly */
    thead tr {
      position: sticky;
      top: 0;
      z-index: 10;
    }
  `]
})
export class LeaderboardComponent implements OnInit {
  private leaderboardService = inject(LeaderboardService);
  private gameService = inject(GameService);

  activeTab: 'weekly' | 'season' | 'winners' = 'weekly';
  loading = false;
  error = '';

  currentWeek = 1;
  currentSeason = new Date().getFullYear();
  selectedWeek = 1;
  availableWeeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

  weeklyLeaderboard: LeaderboardEntry[] = [];
  seasonLeaderboard: LeaderboardEntry[] = [];
  weeklyWinners: WeeklyWinner[] = [];

  currentUserId = 1; // This should come from AuthService

  ngOnInit() {
    // Get current week first, then load data
    this.gameService.getCurrentWeekGames().subscribe({
      next: (response) => {
        // Set current week and selected week to the actual current week
        this.currentWeek = response.week > 0 ? response.week : 1;
        this.selectedWeek = this.currentWeek;
        
        // Load all data on initialization
        this.loadWeeklyLeaderboard();
        this.loadSeasonLeaderboard();
        this.loadWeeklyWinners();
      },
      error: () => {
        // Fallback to week 1 if there's an error
        this.currentWeek = 1;
        this.selectedWeek = 1;
        
        // Load all data on initialization
        this.loadWeeklyLeaderboard();
        this.loadSeasonLeaderboard();
        this.loadWeeklyWinners();
      }
    });
  }

  setActiveTab(tab: 'weekly' | 'season' | 'winners') {
    this.activeTab = tab;
    // Data is already loaded, no need to reload
  }

  loadData() {
    switch (this.activeTab) {
      case 'weekly':
        this.loadWeeklyLeaderboard();
        break;
      case 'season':
        this.loadSeasonLeaderboard();
        break;
      case 'winners':
        this.loadWeeklyWinners();
        break;
    }
  }

  loadWeeklyLeaderboard() {
    this.loading = true;
    this.error = '';

    this.leaderboardService.getWeeklyLeaderboard(this.selectedWeek, this.currentSeason).subscribe({
      next: (response) => {
        this.weeklyLeaderboard = response.leaderboard;
        this.currentWeek = response.week;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading weekly leaderboard:', error);
        this.error = 'Failed to load weekly leaderboard';
        this.loading = false;
      }
    });
  }

  loadSeasonLeaderboard() {
    this.loading = true;
    this.error = '';

    this.leaderboardService.getSeasonLeaderboard(this.currentSeason).subscribe({
      next: (response) => {
        this.seasonLeaderboard = response.leaderboard;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading season leaderboard:', error);
        this.error = 'Failed to load season leaderboard';
        this.loading = false;
      }
    });
  }

  loadWeeklyWinners() {
    this.loading = true;
    this.error = '';

    this.leaderboardService.getWeeklyWinners(this.currentSeason, 12).subscribe({
      next: (response) => {
        this.weeklyWinners = response.winners;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading weekly winners:', error);
        this.error = 'Failed to load weekly winners';
        this.loading = false;
      }
    });
  }

  getRankClass(rank: number): string {
    switch (rank) {
      case 1:
        return 'text-yellow-600 font-bold text-lg';
      case 2:
        return 'text-gray-600 font-bold';
      case 3:
        return 'text-orange-600 font-bold';
      default:
        return 'text-gray-900';
    }
  }

  hasWeeklyTiebreaker(): boolean {
    if (this.weeklyLeaderboard.length < 2) return false;

    const topScore = this.weeklyLeaderboard[0]?.totalPoints;
    const secondScore = this.weeklyLeaderboard[1]?.totalPoints;

    // If top two scores are the same and winner has a tiebreaker difference, then tiebreaker was used
    return topScore === secondScore &&
      this.weeklyLeaderboard[0]?.mondayNightDiff !== null &&
      this.weeklyLeaderboard[1]?.mondayNightDiff !== null;
  }
}
