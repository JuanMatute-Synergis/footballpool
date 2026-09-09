import { Injectable, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * The `beforeinstallprompt` event. Not in lib.dom.d.ts -- it is a
 * Chromium-only extension, so we describe the bits we use.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private swUpdate = inject(SwUpdate);

  private dismissedKey = 'nfl_picks_install_dismissed';

  /** Stashed Chromium install event. Null until the browser offers one. */
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  private canInstallSubject = new BehaviorSubject<boolean>(false);
  /** True when we can trigger a real, native install prompt (Chromium only). */
  public canInstall$ = this.canInstallSubject.asObservable();

  private updateAvailableSubject = new BehaviorSubject<boolean>(false);
  /** True once a newer build has been downloaded and is ready to activate. */
  public updateAvailable$ = this.updateAvailableSubject.asObservable();

  private reopenBannerSubject = new Subject<void>();
  /** Fires when something asks to bring the dismissed install banner back. */
  public reopenBanner$ = this.reopenBannerSubject.asObservable();

  constructor() {
    this.listenForInstallPrompt();
    this.listenForUpdates();
    this.applyStandaloneClass();
  }

  // -------------------------------------------------------------------------
  // Platform / display mode
  // -------------------------------------------------------------------------

  /** iOS and iPadOS, including iPads that report as desktop Safari. */
  get isIos(): boolean {
    const ua = navigator.userAgent;
    const iOsDevice = /iPad|iPhone|iPod/.test(ua);
    // iPadOS 13+ masquerades as Mac; touch points give it away.
    const iPadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    return iOsDevice || iPadOs;
  }

  /** Running from the home screen rather than in a browser tab. */
  get isStandalone(): boolean {
    const displayMode = window.matchMedia('(display-mode: standalone)').matches;
    // Safari doesn't support display-mode; it sets this non-standard flag.
    const iosStandalone = (window.navigator as any).standalone === true;
    return displayMode || iosStandalone;
  }

  /**
   * Whether to offer installation at all. Hidden once installed, and on
   * browsers that can neither prompt nor be walked through it manually.
   */
  get canOfferInstall(): boolean {
    if (this.isStandalone) return false;
    return this.canInstallSubject.value || this.isIos;
  }

  /** iOS has no install API, so the UI has to explain the Share-sheet route. */
  get needsIosInstructions(): boolean {
    return this.isIos && !this.canInstallSubject.value;
  }

  // -------------------------------------------------------------------------
  // Install
  // -------------------------------------------------------------------------

  private listenForInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (event: Event) => {
      // Suppress Chrome's own mini-infobar so our banner is the only prompt.
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.canInstallSubject.next(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstallSubject.next(false);
      this.dismissInstallBanner();
    });
  }

  /**
   * Shows the native install prompt.
   * @returns true if the user accepted, false if they dismissed it or the
   *          prompt was unavailable (e.g. on iOS).
   */
  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;

    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    // The event can only be used once; Chrome fires a fresh one if still eligible.
    this.deferredPrompt = null;
    this.canInstallSubject.next(false);

    return outcome === 'accepted';
  }

  // -------------------------------------------------------------------------
  // Install banner dismissal
  // -------------------------------------------------------------------------

  get installBannerDismissed(): boolean {
    return localStorage.getItem(this.dismissedKey) === 'true';
  }

  dismissInstallBanner(): void {
    localStorage.setItem(this.dismissedKey, 'true');
  }

  /** Lets the "Install app" menu entry re-open a previously dismissed banner. */
  reopenInstallBanner(): void {
    localStorage.removeItem(this.dismissedKey);
    this.reopenBannerSubject.next();
  }

  // -------------------------------------------------------------------------
  // Updates
  // -------------------------------------------------------------------------

  private listenForUpdates(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates.subscribe(event => {
      if (event.type === 'VERSION_READY') {
        this.updateAvailableSubject.next(true);
      }
    });
  }

  /** Activates the downloaded build and reloads into it. */
  async applyUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) return;
    await this.swUpdate.activateUpdate();
    document.location.reload();
  }

  // -------------------------------------------------------------------------
  // Sign-out hygiene
  // -------------------------------------------------------------------------

  /**
   * Drops the service worker's cached API responses on logout.
   *
   * The SW caches by URL and knows nothing about who is signed in, so without
   * this the next person to sign in on a shared device could be served the
   * previous user's data whenever the network is slow or unavailable.
   */
  async clearApiCaches(): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(key => key.includes('ngsw:') && key.includes(':data'))
            .map(key => caches.delete(key))
      );
    } catch (error) {
      console.warn('Could not clear service worker caches on logout', error);
    }
  }

  // -------------------------------------------------------------------------

  /**
   * Marks <html> when launched from the home screen. Everything app-like --
   * the bottom tab bar, safe-area padding, viewport height maths -- keys off
   * this single class rather than re-querying the display mode.
   */
  private applyStandaloneClass(): void {
    const apply = () => {
      document.documentElement.classList.toggle('app-standalone', this.isStandalone);
    };

    apply();
    // Chrome can switch display mode without a reload (e.g. install from tab).
    window.matchMedia('(display-mode: standalone)').addEventListener('change', apply);
  }
}
