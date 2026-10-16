import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { AttendanceHistoryComponent } from './attendance-history.component';

describe('AttendanceHistoryComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1/school-years/year-1/students/archived-student/attendance`;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AttendanceHistoryComponent], providers: [
      provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ studentId: 'archived-student' })), snapshot: { queryParamMap: convertToParamMap({}) } } },
      { provide: WorkspaceAccessService, useValue: { hasPermission: () => true } }
    ] });
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment({ id: 'school-1', code: 'S1', name: 'École', enabled: true, createdAt: '', updatedAt: '' });
    context.selectAcademicYear({ id: 'year-1', establishmentId: 'school-1', name: 'Année', startsOn: '2025-01-01', endsOn: '2027-12-31', enabled: true });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('consulte un élève archivé sans exiger sa fiche active et ne crée pas les journées absentes', () => {
    const fixture = TestBed.createComponent(AttendanceHistoryComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['from'] = '2026-10-01';
    component['to'] = '2026-10-16';
    component['load']();
    TestBed.inject(HttpTestingController).expectOne(`${base}?from=2026-10-01&to=2026-10-16`).flush({
      establishmentId: 'school-1', academicYearId: 'year-1', studentId: 'archived-student', from: '2026-10-01', to: '2026-10-16', records: []
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucun pointage');
    expect(component['history']()?.records).toEqual([]);
  });

  it('refuse les plages inversées ou supérieures à 366 jours', () => {
    const fixture = TestBed.createComponent(AttendanceHistoryComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['from'] = '2025-01-01';
    component['to'] = '2026-01-02';
    component['load']();
    expect(component['error']()).toContain('366 jours');
    component['from'] = '2026-10-16';
    component['to'] = '2026-10-01';
    component['load']();
    expect(component['error']()).toContain('ordonnée');
    TestBed.inject(HttpTestingController).expectNone((request) => request.url.includes('/attendance'));
  });

  it('affiche le refus API sans résultat périmé', () => {
    const fixture = TestBed.createComponent(AttendanceHistoryComponent);
    fixture.detectChanges();
    fixture.componentInstance['load']();
    TestBed.inject(HttpTestingController).expectOne((request) => request.url === base).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(fixture.componentInstance['error']()).toContain('Accès refusé');
    expect(fixture.componentInstance['history']()).toBeNull();
  });
});