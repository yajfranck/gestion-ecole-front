import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { SchoolYearOnboardingService } from './school-year-onboarding.service';

export const schoolYearOnboardingGuard: CanActivateChildFn = (_route, state) => {
  const onboarding = inject(SchoolYearOnboardingService);
  const router = inject(Router);
  const path = state.url.split(/[?#]/)[0];
    if (path === '/access-denied' || path === '/establishments' || path.startsWith('/platform/') || path === '/setup/school-year' || path === '/account/password' || /^\/establishments\/[^/]+\/license(?:-registration)?$/.test(path) || !onboarding.canConfigureSchoolYear()) return true;
  return onboarding.ensure(true).pipe(map((status) => status === 'ready' ? true
    : router.createUrlTree(['/setup/school-year'], { queryParams: { returnUrl: state.url } })));
};
