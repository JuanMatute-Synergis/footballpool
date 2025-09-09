import { Component, Input, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center space-x-6">
            <!-- Dashboard Link -->
            <button 
              (click)="router.navigate(['/dashboard'])"
              class="flex items-center space-x-1 sm:space-x-2 text-gray-600 hover:text-blue-600 transition-colors flex-shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
              </svg>
              <span class="font-medium hidden sm:inline">Dashboard</span>
            </button>
            
            <!-- Page Title -->
            <div class="flex items-center min-w-0 flex-1">
              <div class="w-px h-6 bg-gray-300 mx-2 sm:mx-4 hidden sm:block"></div>
              <div class="min-w-0 flex-1">
                <h1 class="text-lg sm:text-xl font-bold text-gray-900 truncate">{{ pageTitle }}</h1>
                <p *ngIf="pageSubtitle" class="text-xs sm:text-sm text-gray-500 truncate hidden sm:block">{{ pageSubtitle }}</p>
              </div>
            </div>
          </div>
          
          <div class="flex items-center space-x-4">
            <!-- Mobile Menu Button -->
            <div class="md:hidden">
              <button 
                (click)="toggleMobileMenu(); $event.stopPropagation()"
                class="text-gray-600 hover:text-gray-900 p-2 transition-colors">
                <svg *ngIf="!showMobileMenu" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
                <svg *ngIf="showMobileMenu" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <!-- Desktop Navigation Links -->
            <div class="hidden md:flex items-center space-x-4">
              <button 
                (click)="router.navigate(['/picks'])"
                class="text-gray-600 hover:text-blue-600 transition-colors">
                Picks
              </button>
              <button 
                (click)="router.navigate(['/leaderboard'])"
                class="text-gray-600 hover:text-blue-600 transition-colors">
                Leaderboard
              </button>
              <button 
                (click)="router.navigate(['/results'])"
                class="text-gray-600 hover:text-blue-600 transition-colors">
                Results
              </button>
              <button 
                (click)="router.navigate(['/profile'])"
                class="text-gray-600 hover:text-blue-600 transition-colors flex items-center space-x-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                <span>Profile</span>
              </button>
              <button 
                *ngIf="currentUser?.isAdmin"
                (click)="router.navigate(['/admin'])"
                class="text-gray-600 hover:text-blue-600 transition-colors">
                Admin
              </button>
            </div>
            
            <!-- User Info -->
            <div class="relative flex items-center space-x-3">
              <div class="relative">
                <button 
                  (click)="toggleDropdown(); $event.stopPropagation()"
                  class="flex items-center space-x-2 text-gray-700 hover:text-gray-900 transition-colors">
                  <span>{{ currentUser?.firstName }} {{ currentUser?.lastName }}</span>
                  <span *ngIf="currentUser?.isAdmin" class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Admin</span>
                  <svg class="w-4 h-4 transition-transform" [class.rotate-180]="showDropdown" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
                
                <!-- Dropdown Menu -->
                <div *ngIf="showDropdown" class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50"
                     (click)="$event.stopPropagation()">
                  <div class="py-1">
                    <button 
                      (click)="goToProfile()"
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                      <span>Profile Settings</span>
                    </button>
                    <div class="border-t border-gray-100"></div>
                    <button 
                      (click)="logout()"
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile Menu -->
      <div *ngIf="showMobileMenu" class="md:hidden border-t border-gray-200 bg-white"
           (click)="$event.stopPropagation()">
        <div class="px-4 py-2 space-y-1">
          <button 
            (click)="mobileNavigate('/picks')"
            class="block w-full text-left px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-md">
            Picks
          </button>
          <button 
            (click)="mobileNavigate('/leaderboard')"
            class="block w-full text-left px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-md">
            Leaderboard
          </button>
          <button 
            (click)="mobileNavigate('/results')"
            class="block w-full text-left px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-md">
            Results
          </button>
          <button 
            (click)="mobileNavigate('/profile')"
            class="block w-full text-left px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-md flex items-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
            <span>Profile & Settings</span>
          </button>
          <button 
            *ngIf="currentUser?.isAdmin"
            (click)="mobileNavigate('/admin')"
            class="block w-full text-left px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-md">
            Admin
          </button>
          <hr class="my-2 border-gray-200">
          <button 
            (click)="logout()"
            class="block w-full text-left px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-gray-50 rounded-md flex items-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  `,
  styles: []
})
export class NavigationComponent {
  @Input() title: string = '';
  @Input() subtitle: string = '';

  private authService = inject(AuthService);
  public router = inject(Router);

  showDropdown = false;
  showMobileMenu = false;

  get currentUser() {
    return this.authService.currentUser;
  }

  get pageTitle() {
    return this.title;
  }

  get pageSubtitle() {
    return this.subtitle;
  }

  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }

  toggleMobileMenu() {
    this.showMobileMenu = !this.showMobileMenu;
  }

  mobileNavigate(path: string) {
    this.showMobileMenu = false;
    this.router.navigate([path]);
  }

  goToProfile() {
    this.showDropdown = false;
    this.router.navigate(['/profile']);
  }

  logout() {
    this.showDropdown = false;
    this.authService.logout();
    this.router.navigate(['/auth']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;

    // Close dropdowns if clicking outside the navigation
    if (!target.closest('nav')) {
      this.showDropdown = false;
      this.showMobileMenu = false;
    }
  }
}
