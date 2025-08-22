import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service';
import { GameService } from '../../core/services/game.service';
import { User } from '../../core/models/user.model';
import { Game, GamesResponse } from '../../core/models/game.model';

interface AdminStats {
  totalUsers: number;
  totalPicks: number;
  currentWeek: number;
  completedGames: number;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <div class="bg-white shadow">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="py-6">
            <h1 class="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p class="mt-1 text-sm text-gray-500">Manage users, games, and system settings</p>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="px-4 py-6 sm:px-0">
          
          <!-- Stats Cards -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="card p-6 text-center">
              <div class="text-3xl font-bold text-blue-600">{{ stats.totalUsers }}</div>
              <div class="text-sm text-gray-600 mt-1">Total Users</div>
            </div>
            <div class="card p-6 text-center">
              <div class="text-3xl font-bold text-green-600">{{ stats.totalPicks }}</div>
              <div class="text-sm text-gray-600 mt-1">Total Picks</div>
            </div>
            <div class="card p-6 text-center">
              <div class="text-3xl font-bold text-purple-600">{{ stats.currentWeek }}</div>
              <div class="text-sm text-gray-600 mt-1">Current Week</div>
            </div>
            <div class="card p-6 text-center">
              <div class="text-3xl font-bold text-orange-600">{{ stats.completedGames }}</div>
              <div class="text-sm text-gray-600 mt-1">Completed Games</div>
            </div>
          </div>

          <!-- Tabs -->
          <div class="border-b border-gray-200 mb-6">
            <nav class="-mb-px flex space-x-8">
              <button
                (click)="activeTab = 'users'"
                [class]="activeTab === 'users' 
                  ? 'border-blue-500 text-blue-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'">
                Users
              </button>
              <button
                (click)="activeTab = 'games'"
                [class]="activeTab === 'games' 
                  ? 'border-blue-500 text-blue-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'">
                Games
              </button>
              <button
                (click)="activeTab = 'settings'"
                [class]="activeTab === 'settings' 
                  ? 'border-blue-500 text-blue-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'">
                Settings
              </button>
            </nav>
          </div>

          <!-- Loading -->
          <div *ngIf="loading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">Loading...</p>
          </div>

          <!-- Error -->
          <div *ngIf="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p class="text-red-800">{{ error }}</p>
            <button (click)="loadData()" class="mt-2 btn-primary">Try Again</button>
          </div>

          <!-- Success -->
          <div *ngIf="success" class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p class="text-green-800">{{ success }}</p>
          </div>

          <!-- Users Tab -->
          <div *ngIf="activeTab === 'users' && !loading" class="space-y-6">
            <div class="flex justify-between items-center">
              <h2 class="text-lg font-semibold">User Management</h2>
              <button (click)="showCreateUser = !showCreateUser" class="btn-primary">
                {{ showCreateUser ? 'Cancel' : 'Add User' }}
              </button>
            </div>

            <!-- Create User Form -->
            <div *ngIf="showCreateUser" class="card p-6">
              <h3 class="text-lg font-semibold mb-4">Create New User</h3>
              <form (ngSubmit)="createUser()" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" [(ngModel)]="newUser.firstName" name="firstName" required class="input-field">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" [(ngModel)]="newUser.lastName" name="lastName" required class="input-field">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" [(ngModel)]="newUser.email" name="email" required class="input-field">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input type="password" [(ngModel)]="newUser.password" name="password" required class="input-field">
                </div>
                <div class="flex items-center">
                  <input type="checkbox" [(ngModel)]="newUser.isAdmin" name="isAdmin" id="isAdmin" class="mr-2">
                  <label for="isAdmin" class="text-sm text-gray-700">Admin User</label>
                </div>
                <div class="flex space-x-2">
                  <button type="submit" class="btn-primary" [disabled]="creatingUser">
                    {{ creatingUser ? 'Creating...' : 'Create User' }}
                  </button>
                  <button type="button" (click)="resetNewUser()" class="btn-secondary">Reset</button>
                </div>
              </form>
            </div>

            <!-- Users List -->
            <div class="card overflow-hidden">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr *ngFor="let user of users">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {{ user.firstName }} {{ user.lastName }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ user.email }}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span [class]="user.isAdmin ? 'px-2 py-1 bg-red-100 text-red-800 rounded text-xs' : 'px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs'">
                        {{ user.isAdmin ? 'Admin' : 'User' }}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {{ formatDate(user.createdAt) }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button (click)="toggleUserStatus(user)" class="text-blue-600 hover:text-blue-800 mr-2">
                        {{ user.isActive ? 'Deactivate' : 'Activate' }}
                      </button>
                      <button (click)="deleteUser(user.id)" class="text-red-600 hover:text-red-800">
                        Delete
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Games Tab -->
          <div *ngIf="activeTab === 'games' && !loading" class="space-y-6">
            <div class="flex justify-between items-center">
              <h2 class="text-lg font-semibold">Game Management</h2>
              <div class="flex space-x-2">
                <select [(ngModel)]="selectedWeek" (ngModelChange)="loadGames()" class="input-field text-sm">
                  <option *ngFor="let w of availableWeeks" [value]="w">Week {{ w }}</option>
                </select>
                <button (click)="refreshGames()" class="btn-secondary">Refresh Games</button>
              </div>
            </div>

            <!-- Games List -->
            <div class="space-y-4">
              <div *ngFor="let game of games" class="card p-6">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <div class="flex items-center space-x-4 mb-3">
                      <div class="font-semibold">{{ game.visitorTeam.name }} &#64; {{ game.homeTeam.name }}</div>
                      <span [class]="getGameStatusClass(game.status)">{{ game.status }}</span>
                    </div>
                    <div class="text-sm text-gray-600">
                      {{ formatGameTime(game.date) }}
                      <span *ngIf="game.isMonday" class="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">MNF</span>
                    </div>
                  </div>
                  
                  <!-- Score Update Form -->
                  <div *ngIf="game.status !== 'scheduled'" class="ml-4 flex items-center space-x-2">
                    <input 
                      type="number" 
                      [(ngModel)]="game.visitorTeam.score" 
                      placeholder="Away" 
                      class="w-16 input-field text-sm text-center">
                    <span>-</span>
                    <input 
                      type="number" 
                      [(ngModel)]="game.homeTeam.score" 
                      placeholder="Home" 
                      class="w-16 input-field text-sm text-center">
                    <button (click)="updateGameScore(game)" class="btn-primary text-sm">Update</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Settings Tab -->
          <div *ngIf="activeTab === 'settings' && !loading" class="space-y-6">
            <h2 class="text-lg font-semibold">System Settings</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Current Week Setting -->
              <div class="card p-6">
                <h3 class="font-semibold mb-3">Current Week</h3>
                <div class="flex items-center space-x-2">
                  <select [(ngModel)]="currentWeekSetting" class="input-field">
                    <option *ngFor="let w of availableWeeks" [value]="w">Week {{ w }}</option>
                  </select>
                  <button (click)="updateCurrentWeek()" class="btn-primary">Update</button>
                </div>
                <p class="text-sm text-gray-600 mt-2">This affects which week's games are shown by default</p>
              </div>

              <!-- Picks Lock Time -->
              <div class="card p-6">
                <h3 class="font-semibold mb-3">Pick Lock Settings</h3>
                <div class="space-y-2">
                  <label class="block text-sm text-gray-700">Minutes before game start:</label>
                  <div class="flex items-center space-x-2">
                    <input type="number" [(ngModel)]="lockMinutesSetting" class="input-field w-20" min="0" max="1440">
                    <button (click)="updateLockSettings()" class="btn-primary">Update</button>
                  </div>
                  <p class="text-sm text-gray-600">Current: {{ lockMinutesSetting }} minutes</p>
                </div>
              </div>

              <!-- API Settings -->
              <div class="card p-6">
                <h3 class="font-semibold mb-3">API Settings</h3>
                <div class="space-y-3">
                  <button (click)="syncGames()" class="btn-secondary w-full" [disabled]="syncingGames">
                    {{ syncingGames ? 'Syncing...' : 'Sync Games from API' }}
                  </button>
                  <button (click)="updateScores()" class="btn-secondary w-full" [disabled]="updatingScores">
                    {{ updatingScores ? 'Updating...' : 'Update All Scores' }}
                  </button>
                  <p class="text-sm text-gray-600">Last sync: Never</p>
                </div>
              </div>

              <!-- Database Actions -->
              <div class="card p-6">
                <h3 class="font-semibold mb-3 text-red-600">Danger Zone</h3>
                <div class="space-y-2">
                  <button (click)="resetWeekPicks()" class="btn-danger w-full" [disabled]="resetting">
                    {{ resetting ? 'Resetting...' : 'Reset Current Week Picks' }}
                  </button>
                  <button (click)="recalculateScores()" class="btn-secondary w-full" [disabled]="recalculating">
                    {{ recalculating ? 'Recalculating...' : 'Recalculate All Scores' }}
                  </button>
                  <p class="text-sm text-gray-600">These actions cannot be undone!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .btn-danger {
      @apply bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed;
    }
  `]
})
export class AdminComponent implements OnInit {
  private adminService = inject(AdminService);
  private gameService = inject(GameService);

  activeTab: 'users' | 'games' | 'settings' = 'users';
  loading = false;
  error = '';
  success = '';
  
  // Stats
  stats: AdminStats = {
    totalUsers: 0,
    totalPicks: 0,
    currentWeek: 1,
    completedGames: 0
  };

  // Users
  users: User[] = [];
  showCreateUser = false;
  creatingUser = false;
  newUser = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    isAdmin: false
  };

  // Games
  games: Game[] = [];
  selectedWeek = 1;
  availableWeeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

  // Settings
  currentWeekSetting = 1;
  lockMinutesSetting = 60;
  syncingGames = false;
  updatingScores = false;
  resetting = false;
  recalculating = false;

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    switch (this.activeTab) {
      case 'users':
        this.loadUsers();
        break;
      case 'games':
        this.loadGames();
        break;
      case 'settings':
        this.loadSettings();
        break;
    }
    this.loadStats();
  }

  // Stats
  loadStats() {
    // This would make API calls to get stats
    // For now, using placeholder data
    this.stats = {
      totalUsers: this.users.length,
      totalPicks: 150,
      currentWeek: this.currentWeekSetting,
      completedGames: 45
    };
  }

  // Users
  loadUsers() {
    this.loading = true;
    this.adminService.getAllUsers().subscribe({
      next: (response: { users: User[] }) => {
        this.users = response.users;
        this.loading = false;
        this.loadStats();
      },
      error: (error: any) => {
        console.error('Error loading users:', error);
        this.error = 'Failed to load users';
        this.loading = false;
      }
    });
  }

  createUser() {
    this.creatingUser = true;
    this.adminService.createUser(this.newUser).subscribe({
      next: () => {
        this.success = 'User created successfully';
        this.resetNewUser();
        this.showCreateUser = false;
        this.loadUsers();
        this.creatingUser = false;
        setTimeout(() => this.success = '', 3000);
      },
      error: (error: any) => {
        console.error('Error creating user:', error);
        this.error = 'Failed to create user';
        this.creatingUser = false;
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  resetNewUser() {
    this.newUser = {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      isAdmin: false
    };
  }

  toggleUserStatus(user: User) {
    this.adminService.updateUser(user.id, { isActive: !user.isActive }).subscribe({
      next: () => {
        user.isActive = !user.isActive;
        this.success = `User ${user.isActive ? 'activated' : 'deactivated'}`;
        setTimeout(() => this.success = '', 3000);
      },
      error: (error: any) => {
        console.error('Error updating user:', error);
        this.error = 'Failed to update user';
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  deleteUser(userId: number) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    this.adminService.deleteUser(userId).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== userId);
        this.success = 'User deleted successfully';
        setTimeout(() => this.success = '', 3000);
      },
      error: (error: any) => {
        console.error('Error deleting user:', error);
        this.error = 'Failed to delete user';
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  // Games
  loadGames() {
    this.loading = true;
    const currentSeason = new Date().getFullYear();
    
    this.gameService.getWeekGames(currentSeason, this.selectedWeek).subscribe({
      next: (response: GamesResponse) => {
        this.games = response.games;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading games:', error);
        this.error = 'Failed to load games';
        this.loading = false;
      }
    });
  }

  refreshGames() {
    this.loadGames();
  }

  updateGameScore(game: Game) {
    const updateData = {
      homeScore: game.homeTeam.score,
      visitorScore: game.visitorTeam.score,
      status: 'final'
    };

    this.adminService.updateGame(game.id, updateData).subscribe({
      next: () => {
        this.success = 'Game score updated successfully';
        setTimeout(() => this.success = '', 3000);
      },
      error: (error: any) => {
        console.error('Error updating game score:', error);
        this.error = 'Failed to update game score';
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  // Settings
  loadSettings() {
    // Load current settings
    this.currentWeekSetting = this.stats.currentWeek;
  }

  updateCurrentWeek() {
    this.adminService.updateSettings({ currentWeek: this.currentWeekSetting }).subscribe({
      next: () => {
        this.success = 'Current week updated';
        setTimeout(() => this.success = '', 3000);
      },
      error: (error: any) => {
        console.error('Error updating current week:', error);
        this.error = 'Failed to update current week';
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  updateLockSettings() {
    this.adminService.updateSettings({ lockMinutes: this.lockMinutesSetting }).subscribe({
      next: () => {
        this.success = 'Lock settings updated';
        setTimeout(() => this.success = '', 3000);
      },
      error: (error: any) => {
        console.error('Error updating lock settings:', error);
        this.error = 'Failed to update lock settings';
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  syncGames() {
    this.syncingGames = true;
    this.adminService.syncGames().subscribe({
      next: () => {
        this.success = 'Games synced successfully';
        this.syncingGames = false;
        setTimeout(() => this.success = '', 3000);
      },
      error: (error: any) => {
        console.error('Error syncing games:', error);
        this.error = 'Failed to sync games';
        this.syncingGames = false;
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  updateScores() {
    this.updatingScores = true;
    this.adminService.updateAllScores().subscribe({
      next: () => {
        this.success = 'All scores updated';
        this.updatingScores = false;
        setTimeout(() => this.success = '', 3000);
      },
      error: (error: any) => {
        console.error('Error updating scores:', error);
        this.error = 'Failed to update scores';
        this.updatingScores = false;
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  resetWeekPicks() {
    if (!confirm('Are you sure you want to reset all picks for the current week?')) return;
    
    this.resetting = true;
    this.adminService.resetWeekPicks(this.currentWeekSetting).subscribe({
      next: () => {
        this.success = 'Week picks reset successfully';
        this.resetting = false;
        setTimeout(() => this.success = '', 3000);
      },
      error: (error: any) => {
        console.error('Error resetting picks:', error);
        this.error = 'Failed to reset picks';
        this.resetting = false;
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  recalculateScores() {
    this.recalculating = true;
    this.adminService.recalculateScores().subscribe({
      next: () => {
        this.success = 'All scores recalculated';
        this.recalculating = false;
        setTimeout(() => this.success = '', 3000);
      },
      error: (error: any) => {
        console.error('Error recalculating scores:', error);
        this.error = 'Failed to recalculate scores';
        this.recalculating = false;
        setTimeout(() => this.error = '', 3000);
      }
    });
  }

  // Helpers
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatGameTime(gameTime: string): string {
    return new Date(gameTime).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  getGameStatusClass(status: string): string {
    switch (status) {
      case 'scheduled':
        return 'px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs';
      case 'in_progress':
        return 'px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs';
      case 'final':
        return 'px-2 py-1 bg-green-100 text-green-800 rounded text-xs';
      default:
        return 'px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs';
    }
  }
}
