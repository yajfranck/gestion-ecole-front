import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService, AuthTokens } from './auth.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { EmployeeService } from '../service/employee-service/employee.service';
import { Employee } from '../models/employee/employee.model';

describe('WorkspaceAccessService', () => {
  const session = signal<AuthTokens | null>(null);
  const employee = { enabled: true, loginEnabled: true, establishmentId: 'school-1', roles: ['ESTABLISHMENT_ADMIN'], directRoleCodes: [] } as unknown as Employee;
  let getMe: jasmine.Spy;

  beforeEach(() => {
    session.set(null);
    getMe = jasmine.createSpy('getMe').and.returnValue(of(employee));
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(),
      { provide: AuthService, useValue: { session } },
      { provide: EmployeeService, useValue: { getMe } }]
    });
  });

  function access(authorities: string[]) {
    session.set({ accessToken: `header.${btoa(JSON.stringify({ authorities }))}.signature` } as AuthTokens);
    const service = TestBed.inject(WorkspaceAccessService);
    TestBed.flushEffects();
    return service;
  }

  it('autorise ADMIN à modifier sans lui ouvrir les présences', () => {
    const service = access(['ROLE_ADMIN', 'can_establishment_read']);
    expect(service.canUpdateEstablishment('school-1')).toBeTrue();
    expect(service.hasPermission('can_attendance_read', 'school-1')).toBeFalse();
    expect(getMe).not.toHaveBeenCalled();
  });

  it('utilise le rôle effectif hérité et le périmètre employé', () => {
    const service = access(['ROLE_ESTABLISHMENT_ADMIN', 'can_establishment_update', 'can_attendance_read']);
    expect(service.canUpdateEstablishment('school-1')).toBeTrue();
    expect(service.canUpdateEstablishment('school-2')).toBeFalse();
    expect(service.hasPermission('can_attendance_read', 'school-1')).toBeTrue();
    expect(service.hasPermission('can_attendance_write', 'school-1')).toBeFalse();
  });

  it('refuse la modification si le rôle local effectif est absent', () => {
    getMe.and.returnValue(of({ ...employee, roles: ['STAFF'] }));
    expect(access(['can_establishment_update']).canUpdateEstablishment('school-1')).toBeFalse();
  });

  it('refuse un employé désactivé et ne déduit rien du rôle seul', () => {
    getMe.and.returnValue(of({ ...employee, enabled: false }));
    expect(access(['can_attendance_read']).hasPermission('can_attendance_read', 'school-1')).toBeFalse();
    session.set({ accessToken: `header.${btoa(JSON.stringify({ authorities: ['ROLE_ESTABLISHMENT_ADMIN'] }))}.signature` } as AuthTokens);
    TestBed.flushEffects();
    expect(TestBed.inject(WorkspaceAccessService).canUpdateEstablishment('school-1')).toBeFalse();
  });
});