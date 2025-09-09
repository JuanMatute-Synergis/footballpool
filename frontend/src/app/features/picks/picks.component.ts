import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { GameService } from '../../core/services/game.service';
import { PickService } from '../../core/services/pick.service';
import { HttpClient } from '@angular/common/http';
import { Game } from '../../core/models/game.model';
import { Pick } from '../../core/models/pick.model';
import { environment } from '../../../environments/environment';
import { NavigationComponent } from '../../shared/components/navigation.component';

@Component({
  selector: 'app-picks',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NavigationComponent],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Navigation -->
      <app-navigation 
        title="My Picks" 
        [subtitle]="'Week ' + currentWeek + ', ' + currentSeason">
      </app-navigation>

      <!-- Content -->
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
          
          <!-- Stats Header -->
          <div class="bg-white shadow rounded-lg p-6 mb-6">
            <div class="text-center">
              <div class="text-3xl font-bold text-blue-600">{{ picksSubmitted }}/{{ totalGames }}</div>
              <div class="text-sm text-gray-500">Picks Submitted</div>
            </div>
          </div>
          
          <!-- Loading State -->
          <div *ngIf="loading" class="text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">Loading games...</p>
          </div>

          <!-- Error State -->
          <div *ngIf="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p class="text-red-800">{{ error }}</p>
            <button (click)="loadData()" class="mt-2 btn-primary">Try Again</button>
          </div>

          <!-- Games Grid -->
          <div *ngIf="!loading && !error" class="space-y-6">
            <!-- Instructions -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 class="font-semibold text-blue-900">How to Make Picks</h3>
              <ul class="mt-2 text-sm text-blue-800 space-y-1">
                <li>• Select the team you think will win each game</li>
                <li>• Picks are locked once games start</li>
                <li>• For Monday Night games, predict the total combined score</li>
                <li>• Get all picks right for +3 bonus points!</li>
                <li>• Starting Tuesday, you can make picks for next week's games!</li>
              </ul>
            </div>

            <!-- Games -->
            <form [formGroup]="picksForm" (ngSubmit)="submitPicks()">
              <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div *ngFor="let game of games" class="card p-6">
                  <!-- Game Header -->
                  <div class="text-center mb-4">
                    <div class="text-sm text-gray-500">
                      {{ formatGameTime(game.date) }}
                    </div>
                    <div *ngIf="isGameLocked(game)" class="mt-1">
                      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        🔒 Locked
                      </span>
                    </div>
                    <div *ngIf="game.isMonday" class="mt-1">
                      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Monday Night
                      </span>
                    </div>
                  </div>

                  <!-- Teams -->
                <div class="space-y-3">
                    <!-- Visitor Team -->
          <label class="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50" 
            [class.bg-blue-50]="getPickValue(game.id) === game.visitorTeam.id"
            [class.border-2]="getPickValue(game.id) === game.visitorTeam.id"
            [class.border-blue-500]="getPickValue(game.id) === game.visitorTeam.id"
            [class.opacity-50]="isGameLocked(game)"
            [class.pointer-events-none]="isGameLocked(game)"
            [class.cursor-not-allowed]="isGameLocked(game)">
                      <input
                        type="radio"
                        [value]="game.visitorTeam.id"
                        [formControlName]="'pick_' + game.id"
                        [disabled]="isGameLocked(game)"
                        class="text-blue-600 focus:ring-blue-500">
                      <div class="flex items-center space-x-3 flex-1">
                        <img [src]="getTeamLogo(game.visitorTeam.abbreviation)" 
                             [alt]="game.visitorTeam.name"
                             class="w-8 h-8 object-contain"
                             (error)="handleImageError($event, game.visitorTeam.abbreviation)"
                             loading="lazy">
                        <div class="flex-1">
                          <div class="font-medium">{{ game.visitorTeam.city }} {{ game.visitorTeam.name }}</div>
                          <div class="text-sm text-gray-500">&#64; {{ game.homeTeam.abbreviation }}</div>
                        </div>
                        <div *ngIf="game.visitorTeam.score !== undefined" class="text-lg font-bold">
                          {{ game.visitorTeam.score }}
                        </div>
                      </div>
                    </label>

                    <!-- Home Team -->
          <label class="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50"
            [class.bg-blue-50]="getPickValue(game.id) === game.homeTeam.id"
            [class.border-2]="getPickValue(game.id) === game.homeTeam.id"
            [class.border-blue-500]="getPickValue(game.id) === game.homeTeam.id"
            [class.opacity-50]="isGameLocked(game)"
            [class.pointer-events-none]="isGameLocked(game)"
            [class.cursor-not-allowed]="isGameLocked(game)">
                      <input
                        type="radio"
                        [value]="game.homeTeam.id"
                        [formControlName]="'pick_' + game.id"
                        [disabled]="isGameLocked(game)"
                        class="text-blue-600 focus:ring-blue-500">
                      <div class="flex items-center space-x-3 flex-1">
                        <img [src]="getTeamLogo(game.homeTeam.abbreviation)" 
                             [alt]="game.homeTeam.name"
                             class="w-8 h-8 object-contain"
                             (error)="handleImageError($event, game.homeTeam.abbreviation)"
                             loading="lazy">
                        <div class="flex-1">
                          <div class="font-medium">{{ game.homeTeam.city }} {{ game.homeTeam.name }}</div>
                          <div class="text-sm text-gray-500">vs {{ game.visitorTeam.abbreviation }}</div>
                        </div>
                        <div *ngIf="game.homeTeam.score !== undefined" class="text-lg font-bold">
                          {{ game.homeTeam.score }}
                        </div>
                      </div>
                    </label>
                  </div>

                  <!-- Monday Night Prediction -->
                  <div *ngIf="game.isMonday" class="mt-4 pt-4 border-t border-gray-200">
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                           [class.opacity-50]="isGameLocked(game)">
                      Total Score Prediction (Tie-breaker)
                    </label>
                    <input
                      type="number"
                      [formControlName]="'monday_' + game.id"
                      [disabled]="isGameLocked(game)"
                      placeholder="e.g., 45"
                      min="0"
                      max="100"
                      [class.opacity-50]="isGameLocked(game)"
                      class="input-field">
                  </div>

                  <!-- Pick Status -->
                  <div class="mt-4 text-center">
                    <div *ngIf="getPickValue(game.id)" class="text-sm text-green-600">
                      ✓ Pick submitted
                    </div>
                    <div *ngIf="!getPickValue(game.id) && !isGameLocked(game)" class="text-sm text-gray-500">
                      Select a team
                    </div>
                  </div>
                </div>
              </div>

              <!-- Submit Button -->
              <div class="mt-8 text-center" *ngIf="!allGamesLocked()">
                <button
                  type="submit"
                  [disabled]="submitting"
                  class="btn-primary px-8 py-3 text-lg">
                  {{ submitting ? 'Saving...' : 'Save Picks' }}
                </button>
                <p class="mt-2 text-sm text-gray-600">
                  Picks are automatically saved as you make them
                </p>
              </div>
            </form>

            <!-- All Games Locked Message -->
            <div *ngIf="allGamesLocked()" class="text-center py-8">
              <div class="text-6xl mb-4">🔒</div>
              <h3 class="text-lg font-medium text-gray-900">All Games Have Started</h3>
              <p class="text-gray-600">Picks are now locked for this week</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class PicksComponent implements OnInit {
  private gameService = inject(GameService);
  private pickService = inject(PickService);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;


  loading = true;
  error = '';
  submitting = false;

  games: Game[] = [];
  picks: Pick[] = [];
  currentWeek = 1;
  currentSeason = new Date().getFullYear();

  picksForm: FormGroup = this.fb.group({});

  get totalGames(): number {
    return this.games.length;
  }

  get picksSubmitted(): number {
    return this.games.filter(game => this.getPickValue(game.id)).length;
  }

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
  }

  loadData() {
    this.loading = true;
    this.error = '';

    // Load current week games
    this.gameService.getCurrentWeekGames().subscribe({
      next: (response) => {
        this.games = response.games;
        this.currentWeek = response.week;
        this.currentSeason = response.season;

        // Initialize form controls for each game
        this.initializeFormControls();

        // Load existing picks
        this.loadExistingPicks();
      },
      error: (error) => {
        console.error('Error loading games:', error);
        this.error = 'Failed to load games. Please try again.';
        this.loading = false;
      }
    });
  }

  initializeFormControls() {
    const controls: any = {};

    this.games.forEach(game => {
      controls[`pick_${game.id}`] = [''];
      if (game.isMonday) {
        controls[`monday_${game.id}`] = [''];
      }
    });

    this.picksForm = this.fb.group(controls);

    // Auto-save on form changes
    this.picksForm.valueChanges.subscribe(() => {
      if (!this.loading) {
        this.autoSavePicks();
      }
    });
  }

  loadExistingPicks() {
    this.pickService.getUserPicks(this.currentWeek, this.currentSeason).subscribe({
      next: (response) => {
        this.picks = response.picks;

        // Populate form with existing picks
        this.picks.forEach(pick => {
          this.picksForm.patchValue({
            [`pick_${pick.gameId}`]: pick.selectedTeamId,
            [`monday_${pick.gameId}`]: pick.mondayNightPrediction || ''
          });
        });

        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading picks:', error);
        this.loading = false;
      }
    });
  }

  getPickValue(gameId: number): number | null {
    return this.picksForm.get(`pick_${gameId}`)?.value || null;
  }

  getMondayPrediction(gameId: number): number | null {
    const value = this.picksForm.get(`monday_${gameId}`)?.value;
    return value ? parseInt(value) : null;
  }

  isGameLocked(game: Game): boolean {
    const gameTime = new Date(game.date);
    const now = new Date();
    return gameTime <= now || game.status !== 'scheduled';
  }

  allGamesLocked(): boolean {
    return this.games.every(game => this.isGameLocked(game));
  }

  formatGameTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  autoSavePicks() {
    // Save picks automatically with debounce
    setTimeout(() => {
      this.saveChangedPicks();
    }, 1000);
  }

  saveChangedPicks() {
    this.games.forEach(game => {
      const selectedTeamId = this.getPickValue(game.id);
      const mondayPrediction = this.getMondayPrediction(game.id);

      if (selectedTeamId && !this.isGameLocked(game)) {
        const existingPick = this.picks.find(p => p.gameId === game.id);

        // Only save if changed or new
        if (!existingPick ||
          existingPick.selectedTeamId !== selectedTeamId ||
          existingPick.mondayNightPrediction !== mondayPrediction) {

          this.pickService.submitPick({
            gameId: game.id,
            selectedTeamId: selectedTeamId,
            mondayNightPrediction: mondayPrediction || undefined
          }).subscribe({
            next: () => {
              // Update local picks array
              const pickIndex = this.picks.findIndex(p => p.gameId === game.id);
              if (pickIndex >= 0) {
                this.picks[pickIndex].selectedTeamId = selectedTeamId;
                this.picks[pickIndex].mondayNightPrediction = mondayPrediction || undefined;
              } else {
                this.picks.push({
                  gameId: game.id,
                  selectedTeamId: selectedTeamId,
                  mondayNightPrediction: mondayPrediction || undefined
                });
              }
            },
            error: (error) => {
              console.error('Error saving pick:', error);
            }
          });
        }
      }
    });
  }

  submitPicks() {
    this.submitting = true;
    this.saveChangedPicks();

    // Show confirmation message
    setTimeout(() => {
      this.submitting = false;
    }, 1000);
  }

  handleImageError(event: Event, teamAbbreviation: string): void {
    const imgElement = event.target as HTMLImageElement;
    // Fallback to ESPN logo if server logo fails
    imgElement.src = `https://a.espncdn.com/i/teamlogos/nfl/500/${teamAbbreviation?.toUpperCase()}.png`;
  }
}
