import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { LeaderboardEntry, WeeklyWinner } from '../../core/models/leaderboard.model';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <div class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="py-6">
            <h1 class="text-3xl font-bold text-gray-900">Leaderboards</h1>
            <p class="mt-1 text-sm text-gray-500">Track your progress and compete with others</p>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
          
          <!-- Tabs -->
          <div class="border-b border-gray-200">
            <nav class="-mb-px flex space-x-8">
              <button
                (click)="activeTab = 'weekly'"
                [class]="activeTab === 'weekly' 
                  ? 'border-blue-500 text-blue-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'">
                Weekly
              </button>
              <button
                (click)="activeTab = 'season'"
                [class]="activeTab === 'season' 
                  ? 'border-blue-500 text-blue-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'">
                Season
              </button>
              <button
                (click)="activeTab = 'winners'"
                [class]="activeTab === 'winners' 
                  ? 'border-blue-500 text-blue-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'">
                Weekly Winners
              </button>
            </nav>
          </div>

          <!-- Loading -->
          <div *ngIf="loading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">Loading...</p>
          </div>

          <!-- Error -->
          <div *ngIf="error" class="bg-red-50 border border-red-200 rounded-lg p-4 my-6">
            <p class="text-red-800">{{ error }}</p>
            <button (click)="loadData()" class="mt-2 btn-primary">Try Again</button>
          </div>

          <!-- Weekly Tab -->
          <div *ngIf="activeTab === 'weekly' && !loading && !error" class="mt-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold">Week {{ currentWeek }} Leaderboard</h2>
              <div class="flex space-x-2">
                <select [(ngModel)]="selectedWeek" (ngModelChange)="loadWeeklyLeaderboard()" class="input-field text-sm">
                  <option *ngFor="let w of availableWeeks" [value]="w">Week {{ w }}</option>
                </select>
              </div>
            </div>

            <div class="card overflow-hidden">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correct</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bonus</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MNF Diff</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr *ngFor="let entry of weeklyLeaderboard; let i = index" 
                      [class]="entry.userId === currentUserId ? 'bg-blue-50' : ''">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <span [class]="getRankClass(entry.rank)">{{ entry.rank }}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {{ entry.firstName }} {{ entry.lastName }}
                      <span *ngIf="entry.userId === currentUserId" class="ml-2 text-blue-600 font-medium">(You)</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {{ entry.correctPicks }}/{{ entry.totalPicks }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span *ngIf="entry.bonusPoints" class="text-green-600 font-medium">+{{ entry.bonusPoints }}</span>
                      <span *ngIf="!entry.bonusPoints">-</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {{ entry.totalPoints }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span *ngIf="entry.mondayNightDiff !== null">{{ entry.mondayNightDiff }}</span>
                      <span *ngIf="entry.mondayNightDiff === null">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Season Tab -->
          <div *ngIf="activeTab === 'season' && !loading && !error" class="mt-6">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-lg font-semibold">{{ currentSeason }} Season Leaderboard</h2>
            </div>

            <div class="card overflow-hidden">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weeks</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correct</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Perfect</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pts</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg/Week</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr *ngFor="let entry of seasonLeaderboard" 
                      [class]="entry.userId === currentUserId ? 'bg-blue-50' : ''">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <span [class]="getRankClass(entry.rank)">{{ entry.rank }}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {{ entry.firstName }} {{ entry.lastName }}
                      <span *ngIf="entry.userId === currentUserId" class="ml-2 text-blue-600 font-medium">(You)</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {{ entry.weeksPlayed }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {{ entry.totalCorrectPicks }}/{{ entry.totalPicks }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span *ngIf="entry.perfectWeeks" class="text-green-600 font-medium">{{ entry.perfectWeeks }}</span>
                      <span *ngIf="!entry.perfectWeeks">0</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {{ entry.totalPoints }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {{ entry.avgWeeklyPoints }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Winners Tab -->
          <div *ngIf="activeTab === 'winners' && !loading && !error" class="mt-6">
            <h2 class="text-lg font-semibold mb-4">Recent Weekly Winners</h2>

            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div *ngFor="let winner of weeklyWinners" class="card p-6">
                <div class="flex items-center justify-between mb-4">
                  <div class="text-lg font-semibold">Week {{ winner.week }}</div>
                  <div class="text-2xl">🏆</div>
                </div>
                <div class="text-2xl font-bold text-blue-600 mb-2">
                  {{ winner.firstName }} {{ winner.lastName }}
                </div>
                <div class="flex justify-between text-sm text-gray-600">
                  <span>Points: {{ winner.points }}</span>
                  <span *ngIf="winner.isTie">TIE</span>
                </div>
                <div *ngIf="winner.tieBreakerDiff !== null" class="text-xs text-gray-500 mt-1">
                  MNF Diff: {{ winner.tieBreakerDiff }}
                </div>
              </div>
            </div>

            <div *ngIf="weeklyWinners.length === 0" class="text-center py-8 text-gray-500">
              No weekly winners yet. Be the first!
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class LeaderboardComponent implements OnInit {
  private leaderboardService = inject(LeaderboardService);

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
    this.loadData();
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
    
    this.leaderboardService.getWeeklyWinners(12).subscribe({
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
}
