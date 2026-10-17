import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { WorkspaceContextService } from '../../shared/workspace-context.service';
import { DashboardComponent } from './dashboard.component';

const school = { id: 'school', name: 'École Nord', academicYear: { id: 'year', name: '2026-2027', startsOn: '2026-09-01', endsOn: '2027-06-30' }, license: { state: 'ACTIVE', offerCode: 'SCHOOL', validFrom: null, validUntil: null, features: [] }, counts: { students: 12, employees: 3, subjects: 2, classes: 2, enrollments: 10 }, classes: [{ id: 'class', code: '6', name: 'Sixième', series: 'Scientifique', students: 10 }], attendance: { date: '2026-10-17', present: 8, absent: 1, justifiedAbsent: 1, notRecorded: 1 }, finance: [{ currency: 'XOF', amountBilled: 100, amountPaid: 25, balance: 75, overdueBalance: 10 }, { currency: 'EUR', amountBilled: 20, amountPaid: 10, balance: 10, overdueBalance: 0 }], learning: { draftLessons: 1, publishedLessons: 2, draftAssignments: 3, publishedAssignments: 4 } };

describe('DashboardComponent', () => {
  let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ imports: [DashboardComponent], providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])] }); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  function create(payload: object) {
    const fixture = TestBed.createComponent(DashboardComponent); fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/dashboard`).flush(payload);
    return fixture;
  }
  function flushYears() { http.expectOne(`${environment.apiUrl}/establishments/school/school-years`).flush([{ ...school.academicYear, establishmentId: 'school', enabled: true }]); }

  it('affiche seulement les compteurs plateforme sans charger les données des écoles', () => {
    const fixture = create({ scope: 'PLATFORM', generatedAt: '2026-10-17T09:00:00Z', establishment: null, platform: { totalEstablishments: 10, activeEstablishments: 9, disabledEstablishments: 1, activeLicenses: 7, suspendedLicenses: 1, expiredLicenses: 2, upcomingLicenses: 1, establishmentsWithoutActiveLicense: 2 } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Établissements sans licence active');
    expect(fixture.nativeElement.textContent).not.toContain('Présences');
    expect(TestBed.inject(WorkspaceContextService).current()).toBeNull();
    http.expectNone((request) => request.url.includes('/establishments/'));
    fixture.componentInstance['load'](true);
    const refresh = http.expectOne(`${environment.apiUrl}/dashboard`);
    expect(refresh.request.params.keys()).toEqual([]); refresh.flush({ scope: 'PLATFORM', platform: {}, establishment: null });
  });
  it('affiche les agrégats de l’école, sa série et les finances séparées par devise', () => {
    const fixture = create({ scope: 'ESTABLISHMENT', generatedAt: '2026-10-17T09:00:00Z', establishment: school, platform: null });
    flushYears(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('École Nord');
    expect(fixture.nativeElement.textContent).toContain('Scientifique');
    expect(fixture.nativeElement.textContent).toContain('XOF');
    expect(fixture.nativeElement.textContent).toContain('EUR');
    expect(TestBed.inject(WorkspaceContextService).current()?.academicYearId).toBe('year');
    fixture.componentInstance['date'] = '2026-10-18';
    fixture.componentInstance['load'](true);
    http.expectOne(`${environment.apiUrl}/dashboard?academicYearId=year&date=2026-10-18`).flush({ scope: 'ESTABLISHMENT', establishment: school, platform: null });
  });
  it('distingue les fonctionnalités non disponibles des agrégats vides', () => {
    const fixture = create({ scope: 'ESTABLISHMENT', establishment: { ...school, academicYear: null, classes: [], finance: [], attendance: null, learning: null }, platform: null });
    http.expectOne(`${environment.apiUrl}/establishments/school/school-years`).flush([]); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucune année scolaire disponible');
    expect(fixture.nativeElement.textContent).toContain('Aucune créance');
    expect(fixture.nativeElement.textContent).toContain('Fonctionnalité Présences indisponible');
    expect(fixture.nativeElement.textContent).toContain('Fonctionnalité Cours et devoirs indisponible');
  });
  it('explique un refus de permission et supprime les anciens agrégats', () => {
    const fixture = create({ scope: 'ESTABLISHMENT', establishment: school, platform: null }); flushYears();
    fixture.componentInstance['load'](true);
    http.expectOne((request) => request.url.endsWith('/dashboard')).flush(null, { status: 403, statusText: 'Forbidden' }); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('renouveler la session');
    expect(fixture.nativeElement.textContent).not.toContain('École Nord');
  });

  it('conserve la date financière choisie lorsque le module de présences est indisponible', () => {
    const payload = { scope: 'ESTABLISHMENT', establishment: { ...school, attendance: null }, platform: null };
    const fixture = create(payload); flushYears();
    fixture.componentInstance['date'] = '2026-10-18'; fixture.componentInstance['load'](true);
    http.expectOne(`${environment.apiUrl}/dashboard?academicYearId=year&date=2026-10-18`).flush(payload);
    expect(fixture.componentInstance['date']).toBe('2026-10-18');
  });
});
