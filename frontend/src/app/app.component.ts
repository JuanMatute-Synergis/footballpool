import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { BottomTabBarComponent } from './shared/components/bottom-tab-bar.component';
import { InstallPromptComponent } from './shared/components/install-prompt.component';
import { UpdateBannerComponent } from './shared/components/update-banner.component';
import { PwaService } from './core/services/pwa.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    BottomTabBarComponent,
    InstallPromptComponent,
    UpdateBannerComponent
  ],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <app-update-banner></app-update-banner>
      <router-outlet></router-outlet>
      <app-install-prompt></app-install-prompt>
      <app-bottom-tab-bar></app-bottom-tab-bar>
    </div>
  `,
  styles: []
})
export class AppComponent {
  title = 'NFL Weekly Picks';

  // Injected so the service constructs on startup: it needs to be listening for
  // `beforeinstallprompt` and tagging <html> before any page renders.
  private pwa = inject(PwaService);
}
