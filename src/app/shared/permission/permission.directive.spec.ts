import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService, AuthTokens } from '../../core/auth.service';
import { WorkspaceContextService } from '../workspace-context.service';
import { PermissionDirective } from './permission.directive';

@Component({ imports: [PermissionDirective], template: `<button *appPermission="'can_employee_update'">Modifier</button><button *appPermission="'can_license_assign'; global: true; platform: true">Attribuer</button>` })
class PermissionHostComponent {}

describe('PermissionDirective', () => {
  const session = signal<AuthTokens | null>(null);
  function authorize(authorities: string[], permissions: string[], platformPermissions: string[] = [], platformScope = false) {
    session.set({ accessToken: `h.${btoa(JSON.stringify({ authorities, establishmentPermissions: { school: permissions }, platformPermissions, platformScope }))}.s` } as AuthTokens);
  }
  beforeEach(() => {
    authorize(['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'], []);
    TestBed.configureTestingModule({ imports: [PermissionHostComponent], providers: [provideZonelessChangeDetection(), { provide: AuthService, useValue: { session } }] });
    TestBed.inject(WorkspaceContextService).current.set({ establishmentId: 'school', establishmentName: 'École', academicYearId: null, academicYearName: null });
  });
  it('masque les actions d’un administrateur sans droit puis réagit aux permissions renvoyées', () => {
    const fixture = TestBed.createComponent(PermissionHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
    authorize(['ROLE_ADMIN', 'can_employee_update'], ['can_employee_update']);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Modifier');
    expect(fixture.nativeElement.textContent).not.toContain('Attribuer');
    authorize(['can_license_assign'], [], [], true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Attribuer');
    authorize(['can_license_assign'], [], ['can_license_assign'], true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Modifier');
    expect(fixture.nativeElement.textContent).toContain('Attribuer');
  });
  it('masque une action après une révocation reçue lors du changement de contexte', () => {
    authorize(['can_employee_update'], ['can_employee_update']);
    const fixture = TestBed.createComponent(PermissionHostComponent);
    fixture.detectChanges();
    authorize([], []);
    TestBed.inject(WorkspaceContextService).current.set({ establishmentId: 'other', establishmentName: 'Autre', academicYearId: null, academicYearName: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
