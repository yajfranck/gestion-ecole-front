import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { map } from 'rxjs';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.session()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });

  if (authService.session() && !authService.restoring()) {
    return true;
  }

  return authService.ensureSession().pipe(map((ready) => ready || router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })));
};
