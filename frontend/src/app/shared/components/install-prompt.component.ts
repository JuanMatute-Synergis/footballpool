import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, merge } from 'rxjs';
import { PwaService } from '../../core/services/pwa.service';

/**
 * "Add to Home Screen" banner.
 *
 * On Chromium this fires the real install prompt. Safari has no install API at
 * all, so on iOS the button opens a sheet walking through the Share menu --
 * which is the only route Apple offers.
 *
 * Also exposed via `open()` so the nav dropdown and Profile page can re-open it
 * after it has been dismissed.
 */
@Component({
  selector: 'app-install-prompt',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Banner -->
    <div *ngIf="showBanner"
         class="install-banner fixed inset-x-0 z-50 px-4 pb-4">
      <div class="max-w-md mx-auto bg-white rounded-xl shadow-lg border border-gray-200 p-4 flex items-start gap-3">
        <img src="assets/icons/icon-192.png" alt=""
             class="w-11 h-11 rounded-xl flex-shrink-0">
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-gray-900 text-sm">Add NFL Picks to your home screen</p>
          <p class="text-xs text-gray-500 mt-0.5">Opens full screen, no browser bar, works offline.</p>
          <div class="flex gap-2 mt-3">
            <button (click)="install()"
                    class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors">
              {{ needsIosInstructions ? 'Show me how' : 'Install' }}
            </button>
            <button (click)="dismiss()"
                    class="text-gray-500 hover:text-gray-700 text-sm font-medium py-1.5 px-3 rounded-lg transition-colors">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- iOS instructions -->
    <div *ngIf="showIosSheet"
         class="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
         (click)="closeIosSheet()">
      <div class="ios-sheet bg-white w-full max-w-md rounded-t-2xl p-6 pb-8"
           (click)="$event.stopPropagation()">
        <div class="flex items-center gap-3 mb-5">
          <img src="assets/icons/icon-192.png" alt="" class="w-12 h-12 rounded-xl">
          <div>
            <p class="font-semibold text-gray-900">Install NFL Picks</p>
            <p class="text-sm text-gray-500">Two taps in Safari</p>
          </div>
        </div>

        <ol class="space-y-4">
          <li class="flex items-start gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">1</span>
            <span class="text-sm text-gray-700 pt-0.5">
              Tap the
              <!-- iOS Share glyph: a box with an arrow rising out of it -->
              <svg class="inline w-4 h-4 mx-0.5 -mt-0.5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M6 12v6a2 2 0 002 2h8a2 2 0 002-2v-6"></path>
              </svg>
              <strong>Share</strong> button in the Safari toolbar.
            </span>
          </li>
          <li class="flex items-start gap-3">
            <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">2</span>
            <span class="text-sm text-gray-700 pt-0.5">
              Scroll down and choose <strong>Add to Home Screen</strong>.
            </span>
          </li>
        </ol>

        <button (click)="closeIosSheet()"
                class="w-full mt-6 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2.5 rounded-lg transition-colors">
          Got it
        </button>
      </div>
    </div>
  `,
  styles: [`
    /* Sit above the tab bar when it is present, and clear of the home indicator
       when it is not. max() rather than a sum because --app-tabbar-h already
       includes the safe-area inset, and it is 0 outside standalone mode. */
    .install-banner {
      bottom: max(var(--app-tabbar-h), env(safe-area-inset-bottom, 0px));
    }

    .ios-sheet {
      padding-bottom: calc(2rem + env(safe-area-inset-bottom, 0px));
    }
  `]
})
export class InstallPromptComponent implements OnInit, OnDestroy {
  private pwa = inject(PwaService);
  private subscription?: Subscription;

  showBanner = false;
  showIosSheet = false;

  ngOnInit(): void {
    // On iOS there is no event to wait for, so decide immediately; on Chromium
    // canInstall$ flips when beforeinstallprompt fires. reopenBanner$ covers
    // the "Install app" menu entry bringing a dismissed banner back.
    this.refresh();
    this.subscription = merge(this.pwa.canInstall$, this.pwa.reopenBanner$)
      .subscribe(() => this.refresh());
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get needsIosInstructions(): boolean {
    return this.pwa.needsIosInstructions;
  }

  async install(): Promise<void> {
    if (this.needsIosInstructions) {
      this.showBanner = false;
      this.showIosSheet = true;
      return;
    }

    const accepted = await this.pwa.promptInstall();
    if (accepted) this.pwa.dismissInstallBanner();
    this.refresh();
  }

  dismiss(): void {
    this.pwa.dismissInstallBanner();
    this.showBanner = false;
  }

  closeIosSheet(): void {
    this.showIosSheet = false;
    // They've seen the steps; don't nag on every page load.
    this.pwa.dismissInstallBanner();
  }

  private refresh(): void {
    this.showBanner = this.pwa.canOfferInstall && !this.pwa.installBannerDismissed;
  }
}
