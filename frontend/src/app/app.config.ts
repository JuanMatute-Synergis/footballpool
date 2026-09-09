import { ApplicationConfig, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

// Initialize auth service to check for existing tokens
function initializeAuth(authService: AuthService) {
  return () => {
    // This ensures AuthService checks for existing auth and waits for completion
    console.log('Initializing auth service...');
    return authService.initializeAuth();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    importProvidersFrom(BrowserAnimationsModule),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [AuthService],
      multi: true
    },
    // Dev builds stay service-worker free; ngsw-worker.js is only emitted by
    // the production configuration.
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
