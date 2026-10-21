import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router, UrlTree } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { AuthService, AuthTokens } from '../../../core/auth.service';
import { SchoolYearOnboardingService } from '../../../core/school-year-onboarding.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const auth = { login: jasmine.createSpy('login'), session: signal<AuthTokens | null>(null) };
  const onboarding = {
    canConfigureSchoolYear: jasmine.createSpy('canConfigureSchoolYear'),
    ensure: jasmine.createSpy('ensure'),
    establishmentId: signal<string | null>('school')
  };
  let requested: string | null;

  beforeEach(() => {
    requested = null;
    auth.session.set(null);
    auth.login.calls.reset(); auth.login.and.returnValue(of({}));
    onboarding.canConfigureSchoolYear.and.returnValue(true);
    onboarding.ensure.calls.reset(); onboarding.ensure.and.returnValue(of('ready'));
    onboarding.establishmentId.set('school');
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideZonelessChangeDetection(), provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: SchoolYearOnboardingService, useValue: onboarding },
        { provide: ActivatedRoute, useValue: { snapshot: { get queryParamMap() { return convertToParamMap(requested ? { returnUrl: requested } : {}); } } } }
      ]
    });
  });

  function login() {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['login'] = ' admin@example.test ';
    component['password'] = 'mot-de-passe-test';
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
    component['submit']();
    return { component, navigate, router };
  }

  for (const destination of [null, '/dashboard', '/dashboard?date=2026-10-18', '/', '/establishments']) {
    it(`ouvre le portail des établissements après connexion (${destination})`, () => {
      requested = destination;
      const { component, navigate } = login();
      expect(auth.login).toHaveBeenCalledOnceWith({ login: 'admin@example.test', password: 'mot-de-passe-test' });
      expect(onboarding.ensure).toHaveBeenCalledOnceWith(true);
      expect(navigate).toHaveBeenCalledOnceWith('/establishments');
      expect(component['isSubmitting']()).toBeFalse();
    });
  }

  it('conserve un lien direct vers une page de l’établissement', () => {
    requested = '/establishments/school/students?studentId=alice';
    expect(login().navigate).toHaveBeenCalledOnceWith(requested);
  });

  it('demande d’abord l’année manquante puis reprend l’ouverture du portail', () => {
    onboarding.ensure.and.returnValue(of('required'));
    const { navigate, router } = login();
    expect(router.serializeUrl(navigate.calls.mostRecent().args[0] as UrlTree))
      .toBe('/setup/school-year?returnUrl=%2Festablishments');
  });

  it('redirige vers la vérification si les années sont inaccessibles', () => {
    onboarding.ensure.and.returnValue(of('error'));
    const { navigate, router } = login();
    expect(router.serializeUrl(navigate.calls.mostRecent().args[0] as UrlTree)).toContain('/setup/school-year');
  });

  it('ouvre la liste des établissements pour un utilisateur habilité sans rôle administrateur', () => {
    onboarding.canConfigureSchoolYear.and.returnValue(false);
    auth.session.set({ accessToken: `header.${btoa(JSON.stringify({ authorities: ['can_student_read'] }))}.signature` } as AuthTokens);
    expect(login().navigate).toHaveBeenCalledOnceWith('/establishments');
    expect(onboarding.ensure).not.toHaveBeenCalled();
  });

  it('n’ouvre plus le dashboard pour un administrateur plateforme', () => {
    onboarding.canConfigureSchoolYear.and.returnValue(false);
    auth.session.set({ accessToken: `header.${btoa(JSON.stringify({ authorities: ['can_dashboard_read'] }))}.signature` } as AuthTokens);
    expect(login().navigate).toHaveBeenCalledOnceWith('/establishments');
    expect(onboarding.ensure).not.toHaveBeenCalled();
  });

  it('respecte le lien direct d’un utilisateur sans rôle administrateur', () => {
    onboarding.canConfigureSchoolYear.and.returnValue(false);
    requested = '/establishments/school-2/students';
    expect(login().navigate).toHaveBeenCalledOnceWith(requested);
  });

  it('ignore une destination externe après connexion', () => {
    requested = '//example.test';
    expect(login().navigate).toHaveBeenCalledOnceWith('/establishments');
  });

  it('attend la vérification sans accepter une deuxième soumission', () => {
    const check = new Subject<'ready'>();
    onboarding.ensure.and.returnValue(check);
    const { component, navigate } = login();
    expect(component['isSubmitting']()).toBeTrue();
    expect(navigate).not.toHaveBeenCalled();
    component['submit']();
    expect(auth.login).toHaveBeenCalledTimes(1);
    check.next('ready'); check.complete();
    expect(navigate).toHaveBeenCalledOnceWith('/establishments');
    expect(component['isSubmitting']()).toBeFalse();
  });

  it('conserve le message de connexion refusée sans charger l’établissement', () => {
    auth.login.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const { component, navigate } = login();
    expect(component['errorMessage']()).toBe('Identifiant ou mot de passe incorrect.');
    expect(component['isSubmitting']()).toBeFalse();
    expect(onboarding.ensure).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
