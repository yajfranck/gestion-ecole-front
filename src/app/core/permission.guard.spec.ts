import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService, AuthTokens } from './auth.service';
import { permissionGuard } from './permission.guard';

describe('permissionGuard', () => {
  const session = signal<AuthTokens | null>(null);
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: AuthService, useValue: { session } }] }));
  const run = (id: string) => {
    const route = { data: { permissions: ['can_student_read'] }, pathFromRoot: [{ paramMap: convertToParamMap({ establishmentId: id }) }] } as unknown as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() => permissionGuard(route, {} as RouterStateSnapshot));
  };
  it('refuse le rôle administrateur seul et autorise la permission explicite du JWT', () => {
    session.set({ accessToken: `h.${btoa(JSON.stringify({ authorities: ['ROLE_ADMIN'] }))}.s` } as AuthTokens);
    expect(TestBed.inject(Router).serializeUrl(run('school') as UrlTree)).toBe('/access-denied');
    session.set({ accessToken: `h.${btoa(JSON.stringify({ authorities: ['can_student_read'] }))}.s` } as AuthTokens);
    expect(run('school')).toBeTrue();
    expect(run('other')).toBeTrue(); // Le backend vérifie le rattachement, absent du contrat JWT.
  });

  it('refuse une route plateforme sans scope explicite', () => {
    const route = { data: { permissions: ['can_dashboard_read'], platformPermissions: true }, pathFromRoot: [] } as unknown as ActivatedRouteSnapshot;
    session.set({ accessToken: `h.${btoa(JSON.stringify({ authorities: ['can_dashboard_read'] }))}.s` } as AuthTokens);
    const denied = TestBed.runInInjectionContext(() => permissionGuard(route, {} as RouterStateSnapshot)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(denied)).toBe('/access-denied');

    session.set({ accessToken: `h.${btoa(JSON.stringify({ authorities: ['can_dashboard_read'], platformScope: true, platformPermissions: ['can_dashboard_read'] }))}.s` } as AuthTokens);
    expect(TestBed.runInInjectionContext(() => permissionGuard(route, {} as RouterStateSnapshot))).toBeTrue();
  });
});
