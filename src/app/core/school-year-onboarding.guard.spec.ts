import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { schoolYearOnboardingGuard } from './school-year-onboarding.guard';
import { SchoolYearOnboardingService } from './school-year-onboarding.service';

describe('schoolYearOnboardingGuard', () => {
  const service = { canConfigureSchoolYear: jasmine.createSpy('canConfigureSchoolYear'), ensure: jasmine.createSpy('ensure') };
  beforeEach(() => { service.canConfigureSchoolYear.and.returnValue(true); service.ensure.calls.reset(); service.ensure.and.returnValue(of('required')); TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: SchoolYearOnboardingService, useValue: service }] }); });
  const run = (url: string) => TestBed.runInInjectionContext(() => schoolYearOnboardingGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
  it('intercepte aussi un lien direct et conserve la destination demandée', async () => {
    const result = await firstValueFrom(run('/establishments/school/students') as Observable<UrlTree>); expect(TestBed.inject(Router).serializeUrl(result)).toBe('/setup/school-year?returnUrl=%2Festablishments%2Fschool%2Fstudents'); expect(service.ensure).toHaveBeenCalledWith(true);
  });
  it('laisse passer un administrateur ayant déjà une année scolaire', async () => {
    service.ensure.and.returnValue(of('ready')); expect(await firstValueFrom(run('/dashboard') as Observable<boolean>)).toBeTrue();
  });
  it('laisse accessibles la configuration initiale et la consultation de licence', () => {
    expect(run('/setup/school-year')).toBeTrue(); expect(run('/account/password')).toBeTrue(); expect(run('/establishments/school/license')).toBeTrue(); expect(service.ensure).not.toHaveBeenCalled();
  });
  it('laisse enregistrer la licence avant de configurer la première année scolaire', () => {
    expect(run('/establishments/school/license-registration')).toBeTrue();
    expect(service.ensure).not.toHaveBeenCalled();
  });
  it('redirige vers la vérification en cas d’erreur au lieu de contourner le parcours', async () => {
    service.ensure.and.returnValue(of('error')); const result = await firstValueFrom(run('/dashboard') as Observable<UrlTree>); expect(TestBed.inject(Router).serializeUrl(result)).toContain('/setup/school-year');
  });
});
