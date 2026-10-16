import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { AttendanceEntry, AttendanceSheet } from '../../../models/attendance/attendance.model';
import { PendingChangesService } from '../../../shared/pending-changes.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { AttendanceSheetComponent } from './attendance-sheet.component';

describe('AttendanceSheetComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1/school-years/year-1`;
  const year = { id: 'year-1', establishmentId: 'school-1', name: '2026-2027', startsOn: '2026-09-01', endsOn: '2027-06-30', enabled: true };
  const entry = (studentId: string, status: AttendanceEntry['status']): AttendanceEntry => ({
    studentId, studentNumber: studentId, firstName: studentId, lastName: 'Élève', status, absenceJustified: false,
    comment: null, createdBy: null, updatedBy: null, createdAt: null, updatedAt: status === 'NON_RENSEIGNE' ? null : '2026-10-16T08:00:00Z'
  });
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let writable: boolean;

  beforeEach(() => {
    writable = true;
    params = new BehaviorSubject(convertToParamMap({ establishmentId: 'school-1', academicYearId: 'year-1' }));
    TestBed.configureTestingModule({ imports: [AttendanceSheetComponent], providers: [
      provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { parent: { paramMap: params }, snapshot: {} } },
      { provide: WorkspaceAccessService, useValue: { hasPermission: (permission: string) => permission === 'can_attendance_read' || writable } }
    ] });
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment({ id: 'school-1', code: 'S1', name: 'École', enabled: true, createdAt: '', updatedAt: '' });
    context.selectAcademicYear(year);
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true }));

  function setup() {
    const fixture = TestBed.createComponent(AttendanceSheetComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${base}/classes`).flush([{ id: 'class-1', establishmentId: 'school-1', academicYearId: 'year-1', name: 'Classe A', enabled: true }]);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['date'].set('2026-10-16');
    component['classId'].set('class-1');
    component['load']();
    const sheet: AttendanceSheet = { establishmentId: 'school-1', academicYearId: 'year-1', schoolClassId: 'class-1', date: '2026-10-16', presentCount: 1, absentCount: 1, unreportedCount: 1,
      entries: [entry('student-1', 'NON_RENSEIGNE'), entry('student-2', 'ABSENT'), entry('student-3', 'PRESENT')] };
    http.expectOne(`${base}/classes/class-1/attendance?date=2026-10-16`).flush(sheet);
    fixture.detectChanges();
    return { fixture, component, http, sheet, pending: TestBed.inject(PendingChangesService) };
  }

  it('distingue absent, présent et non renseigné avec les totaux', () => {
    const { component, fixture } = setup();
    expect(component['present']()).toBe(1);
    expect(component['absent']()).toBe(1);
    expect(component['unreported']()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Non renseigné');
  });

  it('marque seulement les non renseignés, sans enregistrer automatiquement', () => {
    const { component, http, pending } = setup();
    component['markUnreported']();
    expect(component['rows']().map((row) => row.status)).toEqual(['PRESENT', 'ABSENT', 'PRESENT']);
    expect(pending.dirty()).toBeTrue();
    http.expectNone((request) => request.method === 'PUT');
  });

  it('enregistre seulement les changements et protège les corrections par updatedAt', () => {
    const { component, http, sheet, pending } = setup();
    component['update']('student-2', { status: 'PRESENT' });
    component['save']();
    component['save']();
    const request = http.expectOne(`${base}/classes/class-1/attendance/2026-10-16`);
    expect(request.request.body.entries).toEqual([{ studentId: 'student-2', status: 'PRESENT', absenceJustified: false, comment: null, expectedUpdatedAt: '2026-10-16T08:00:00Z' }]);
    request.flush({ ...sheet, entries: sheet.entries.map((row) => row.studentId === 'student-2' ? { ...row, status: 'PRESENT' } : row) });
    expect(pending.dirty()).toBeFalse();
    expect(pending.saving()).toBeFalse();
  });

  it('saisit et justifie une nouvelle absence sans version inventée', () => {
    const { component, http, sheet } = setup();
    component['update']('student-1', { status: 'ABSENT', absenceJustified: true, comment: 'Maladie' });
    component['save']();
    const request = http.expectOne(`${base}/classes/class-1/attendance/2026-10-16`);
    expect(request.request.body.entries).toEqual([{ studentId: 'student-1', status: 'ABSENT', absenceJustified: true, comment: 'Maladie' }]);
    request.flush(sheet);
  });

  it('ne permet pas de supprimer un pointage enregistré via NON_RENSEIGNE', () => {
    const { component, pending } = setup();
    component['update']('student-2', { status: 'NON_RENSEIGNE' });
    expect(component['rows']()[1].status).toBe('ABSENT');
    expect(pending.dirty()).toBeFalse();
  });

  for (const status of [400, 403, 409, 500]) {
    it(`conserve le brouillon après erreur ${status}`, () => {
      const { component, http, pending } = setup();
      component['update']('student-2', { comment: 'Justification en cours' });
      component['save']();
      http.expectOne(`${base}/classes/class-1/attendance/2026-10-16`).flush({}, { status, statusText: 'Erreur' });
      expect(component['rows']()[1].comment).toBe('Justification en cours');
      expect(pending.dirty()).toBeTrue();
      expect(pending.saving()).toBeFalse();
      expect(component['conflict']()).toBe(status === 409);
      if (status === 409) {
        component['save']();
        http.expectNone((request) => request.method === 'PUT');
      }
    });
  }

  it('préserve classe et date si le changement non enregistré est annulé', () => {
    const { component, pending } = setup();
    component['markUnreported']();
    spyOn(window, 'confirm').and.returnValue(false);
    const select = document.createElement('select');
    select.add(new Option('Classe A', 'class-1'));
    component['changeClass']('class-2', select);
    const input = document.createElement('input');
    input.type = 'date';
    component['changeDate']('2026-10-17', input);
    expect(component['classId']()).toBe('class-1');
    expect(select.value).toBe('class-1');
    expect(component['date']()).toBe('2026-10-16');
    expect(input.value).toBe('2026-10-16');
    expect(pending.dirty()).toBeTrue();
  });

  it('réinitialise les données après changement de contexte accepté', () => {
    const { component, http, pending } = setup();
    component['markUnreported']();
    spyOn(window, 'confirm').and.returnValue(true);
    component['changeClass']('', document.createElement('select'));
    expect(component['rows']()).toEqual([]);
    expect(pending.dirty()).toBeFalse();
    http.expectNone((request) => request.url.includes('/attendance'));
  });

  it('bloque les dates hors année et respecte le mode lecture seule', () => {
    writable = false;
    const { component, fixture, http } = setup();
    component['markUnreported']();
    expect(component['rows']()[0].status).toBe('NON_RENSEIGNE');
    expect(fixture.nativeElement.textContent).toContain('Lecture seule');
    component['date'].set('2028-01-01');
    component['load']();
    expect(component['error']()).toContain('année scolaire');
    http.expectNone((request) => request.url.includes('/attendance'));
  });

  it('protège la fermeture de page quand une saisie est en cours', () => {
    const { component } = setup();
    component['markUnreported']();
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component.beforeUnload(event);
    expect(event.defaultPrevented).toBeTrue();
  });
});