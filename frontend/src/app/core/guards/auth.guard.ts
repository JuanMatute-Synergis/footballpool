import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

export const AuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if we have a token first
  if (!authService.isAuthenticated) {
    router.navigate(['/auth']);
    return false;
  }

  // If we have a token but no current user, wait for the user to be loaded
  return authService.currentUser$.pipe(
    take(1),
    map(user => {
      if (user !== null || authService.isAuthenticated) {
        return true;
      }
      
      router.navigate(['/auth']);
      return false;
    })
  );
};
