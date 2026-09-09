import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaService } from '../../core/services/pwa.service';

/**
 * Shown when a deploy has landed and a newer build is sitting downloaded and
 * ready. Without this the service worker would keep serving the old build
 * until every tab is closed.
 */
@Component({
  selector: 'app-update-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="pwa.updateAvailable$ | async"
         class="update-banner fixed inset-x-0 top-0 z-50 bg-blue-600 text-white">
      <div class="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <span class="text-sm font-medium">A new version is available.</span>
        <button (click)="reload()"
                [disabled]="reloading"
                class="bg-white/15 hover:bg-white/25 disabled:opacity-60 text-white text-sm font-semibold py-1 px-3 rounded-md transition-colors flex-shrink-0">
          {{ reloading ? 'Updating...' : 'Reload' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .update-banner {
      padding-top: env(safe-area-inset-top, 0px);
    }
  `]
})
export class UpdateBannerComponent {
  pwa = inject(PwaService);

  reloading = false;

  async reload(): Promise<void> {
    this.reloading = true;
    await this.pwa.applyUpdate();
  }
}
