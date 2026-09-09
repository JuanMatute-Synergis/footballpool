import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * Native-style bottom tab bar, shown only when the app is running from the
 * home screen (the `app-standalone` class on <html>, set by PwaService).
 *
 * Its height is mirrored in the `--app-tabbar-h` custom property in
 * styles.scss, which is what keeps page content from sliding underneath it.
 */
@Component({
  selector: 'app-bottom-tab-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav *ngIf="isAuthenticated"
         class="app-tabbar fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200">
      <div class="flex justify-around items-stretch h-14">
        <a *ngFor="let tab of tabs"
           [routerLink]="tab.path"
           routerLinkActive="text-blue-600"
           #link="routerLinkActive"
           class="flex flex-col items-center justify-center flex-1 gap-0.5 text-gray-500 active:bg-gray-50 transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
               [attr.stroke-width]="link.isActive ? 2.4 : 1.8">
            <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="tab.icon"></path>
          </svg>
          <span class="text-[10px] leading-none font-medium">{{ tab.label }}</span>
        </a>
      </div>
    </nav>
  `,
  styles: [`
    /* Keep the bar clear of the iPhone home indicator. The padding sits below
       the 3.5rem row, so --app-tabbar-h accounts for both. */
    .app-tabbar {
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
  `]
})
export class BottomTabBarComponent {
  private authService = inject(AuthService);

  tabs = [
    {
      path: '/dashboard',
      label: 'Home',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
    },
    {
      path: '/picks',
      label: 'Picks',
      icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z'
    },
    {
      path: '/leaderboard',
      label: 'Standings',
      icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z'
    },
    {
      path: '/results',
      label: 'Results',
      icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2'
    },
    {
      path: '/profile',
      label: 'Profile',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
    }
  ];

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated;
  }
}
