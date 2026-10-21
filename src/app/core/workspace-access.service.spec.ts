import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService, AuthTokens } from './auth.service';
import { WorkspaceAccessService } from './workspace-access.service';

describe('WorkspaceAccessService', () => {
  const session = signal<AuthTokens | null>(null);
  const restoring = signal(false);
  beforeEach(() => {
    session.set(null); restoring.set(false);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), { provide: AuthService, useValue: { session, restoring } }] });
  });
  function authorize(authorities: string[]) {
    session.set({ accessToken: `header.${btoa(JSON.stringify({ authorities }))}.signature` } as AuthTokens);
    return TestBed.inject(WorkspaceAccessService);
  }
  it('refuse ADMIN et SUPER_ADMIN sans permission, y compris hasPermission', () => {
    const service = authorize(['ROLE_ADMIN', 'ROLE_SUPER_ADMIN']);
    expect(service.canUpdateEstablishment('school')).toBeFalse();
    expect(service.has('can_dashboard_read')).toBeFalse();
    expect(service.hasPermission('ROLE_ADMIN')).toBeFalse();
  });
  it('lit les autorités émises réellement par le backend, sans claim fictif', () => {
    const service = authorize(['can_student_read']);
    expect(service.hasPermission('can_student_read', 'school')).toBeTrue();
    expect(service.hasPermission('can_student_create', 'school')).toBeFalse();
    expect(service.hasPermission('can_student_read', '')).toBeFalse();
  });
  it('combine explicitement OR et AND sans donner de droit de lecture par création', () => {
    const service = authorize(['can_student_create', 'can_student_update']);
    expect(service.hasAnyPermission(['can_student_read', 'can_student_create'])).toBeTrue();
    expect(service.hasAllPermissions(['can_student_read', 'can_student_create'])).toBeFalse();
    expect(service.allows({ all: ['can_student_create', { any: ['can_student_read', 'can_student_update'] }] })).toBeTrue();
    expect(service.hasAnyPermission([])).toBeFalse();
    expect(service.hasAllPermissions([])).toBeFalse();
    expect(service.allows({})).toBeFalse();
  });
  it('exige le scope explicite pour utiliser une permission plateforme', () => {
    const service = authorize(['can_dashboard_read']);
    expect(service.hasPlatformPermission('can_dashboard_read')).toBeFalse();

    session.set({ accessToken: `h.${btoa(JSON.stringify({ authorities: ['can_dashboard_read'], platformScope: true, platformPermissions: ['can_dashboard_read'] }))}.s` } as AuthTokens);
    expect(service.hasPlatformPermission('can_dashboard_read')).toBeTrue();

    session.set({ accessToken: `h.${btoa(JSON.stringify({ authorities: ['can_dashboard_read'], platformScope: false, platformPermissions: ['can_dashboard_read'] }))}.s` } as AuthTokens);
    expect(service.hasPlatformPermission('can_dashboard_read')).toBeFalse();
  });
  it('retire immédiatement les droits lors d’un renouvellement, changement de compte ou logout', () => {
    const service = authorize(['can_student_read']);
    expect(service.has('can_student_read')).toBeTrue();
    authorize(['can_position_read']);
    expect(service.has('can_student_read')).toBeFalse();
    expect(service.has('can_position_read')).toBeTrue();
    session.set(null);
    expect(service.authorities()).toEqual([]);
  });
  it('ne donne aucun droit pendant la restauration de session', () => {
    const service = authorize(['can_student_read']);
    restoring.set(true);
    expect(service.has('can_student_read')).toBeFalse();
    restoring.set(false);
    expect(service.has('can_student_read')).toBeTrue();
  });
  it('refuse les jetons absents, incomplets ou invalides', () => {
    const service = TestBed.inject(WorkspaceAccessService);
    for (const accessToken of ['', 'invalid', `x.${btoa('{"authorities":[null,42,"ROLE_ADMIN"]}')}.s`]) {
      session.set({ accessToken } as AuthTokens);
      expect(service.hasPermission('can_student_read', 'school')).toBeFalse();
    }
  });
});
