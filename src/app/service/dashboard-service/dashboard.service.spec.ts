import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DashboardService } from './dashboard.service';
import { AuthService, AuthTokens } from '../../core/auth.service';
import { WorkspaceContextService } from '../../shared/workspace-context.service';
import { environment } from '../../../environments/environment';

describe('DashboardService', () => {
  const session = signal<AuthTokens | null>(null);
  function authorize(authorities: string[], establishmentPermissions = {}, platformPermissions: string[] = [], platformScope = false) {
    session.set({ accessToken: `h.${btoa(JSON.stringify({ authorities, establishmentPermissions, platformPermissions, platformScope }))}.s` } as AuthTokens);
  }
  beforeEach(() => {
    authorize([]);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { session } }] });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('consulte les agrégats plateforme avec la permission explicite', () => {
    authorize(['can_dashboard_read'], {}, ['can_dashboard_read'], true);
    TestBed.inject(DashboardService).get().subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(`${environment.apiUrl}/dashboard`);
    expect(request.request.params.keys()).toEqual([]);
    request.flush({});
  });
  it('transmet les deux identifiants sélectionnés et le filtre de date', () => {
    authorize(['can_dashboard_read'], { school: ['can_dashboard_read'] });
    TestBed.inject(WorkspaceContextService).current.set({ establishmentId: 'school', establishmentName: 'École', academicYearId: 'year', academicYearName: 'Année' });
    TestBed.inject(DashboardService).get({ date: '2026-10-17' }).subscribe();
    TestBed.inject(HttpTestingController).expectOne(`${environment.apiUrl}/establishments/school/school-years/year/dashboard?date=2026-10-17`).flush({});
  });
  it('refuse un tableau de bord sans permission, même sans contexte', () => {
    authorize([]);
    let rejected = false;
    TestBed.inject(DashboardService).get().subscribe({ error: () => rejected = true });
    expect(rejected).toBeTrue();
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
