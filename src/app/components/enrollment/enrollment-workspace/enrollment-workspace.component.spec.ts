import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { EnrollmentWorkspaceComponent } from './enrollment-workspace.component';

describe('EnrollmentWorkspaceComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [EnrollmentWorkspaceComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { get paramMap() { return of(this.snapshot.paramMap); }, get queryParamMap() { return of(this.snapshot.queryParamMap); }, snapshot: { paramMap: convertToParamMap({ establishmentId: 'school-1', academicYearId: 'year-1' }), queryParamMap: convertToParamMap({}) } } }
    ]
  }));

  function flushAll(http: HttpTestingController, enrollments: unknown[] = []): void {
    http.expectOne(`${base}/students`).flush([{ id: 'st-1', establishmentId: 'school-1', studentNumber: 'STU-1', firstName: 'Ada', lastName: 'Lovelace', enabled: true }]);
    http.expectOne(`${base}/school-years/year-1/classes`).flush([{ id: 'c-1', establishmentId: 'school-1', academicYearId: 'year-1', code: 'P1-A', name: 'Primary 1 A', enabled: true }]);
    http.expectOne(`${base}/school-years/year-1/enrollments`).flush(enrollments);
    if (enrollments.length) http.expectOne(`${base}/school-years/year-1/classes/c-1/classrooms`).flush([{ id: 'room', establishmentId: 'school-1', academicYearId: 'year-1', schoolClassId: 'c-1', code: 'A', name: 'Salle A', maxStudents: 40, enabled: true }]);
  }

  it('inscrit des élèves du dossier établissement dans les classes de l’année', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent);
    fixture.detectChanges();
    flushAll(http);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Primary 1 A');
    expect(text).toContain('Aucune inscription enregistrée');
    http.verify();
  });

  it('affiche les inscriptions existantes', () => {
    const http = TestBed.inject(HttpTestingController);
    const route = TestBed.inject(ActivatedRoute) as unknown as { snapshot: { queryParamMap: unknown } };
    route.snapshot.queryParamMap = convertToParamMap({ studentId: 'st-1', classId: 'c-1' });
    const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent);
    fixture.detectChanges();
    flushAll(http);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as { studentId: string; schoolClassId: string };
    expect(component.studentId).toBe('st-1');
    expect(component.schoolClassId).toBe('c-1');
    http.expectOne(`${base}/school-years/year-1/classes/c-1/classrooms`).flush([]);
    http.verify();
  });

  it('ignore un élève ou une classe inconnus dans l’URL', () => {
    const http = TestBed.inject(HttpTestingController);
    const route = TestBed.inject(ActivatedRoute) as unknown as { snapshot: { queryParamMap: unknown } };
    route.snapshot.queryParamMap = convertToParamMap({ studentId: 'inconnu', classId: 'inconnue' });
    const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent);
    fixture.detectChanges();
    flushAll(http);

    const component = fixture.componentInstance as unknown as { studentId: string; schoolClassId: string };
    expect(component.studentId).toBe('');
    expect(component.schoolClassId).toBe('');
    http.verify();
  });

  it('affiche les inscriptions existantes avec liens vers l’élève et la classe', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent);
    fixture.detectChanges();
    flushAll(http, [{ id: 'e-1', establishmentId: 'school-1', studentId: 'st-1', academicYearId: 'year-1', schoolClassId: 'c-1', createdAt: '2026-10-01T00:00:00Z' }]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('déjà inscrit');
    const hrefs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/establishments/school-1/students?studentId=st-1');
    expect(hrefs).toContain('/establishments/school-1/school-years/year-1/classes?classId=c-1');
    http.verify();
  });

  it('change la salle dans la même inscription sans renvoyer de paiement', () => {
    TestBed.overrideProvider(WorkspaceAccessService, { useValue: { authorities: signal(['can_enrollment_update']) } });
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent); fixture.detectChanges();
    flushAll(http, [{ id: 'e-1', establishmentId: 'school-1', studentId: 'st-1', academicYearId: 'year-1', schoolClassId: 'c-1', classroomId: 'room' }]); fixture.detectChanges();
    const component = fixture.componentInstance; const enrollment = component['enrollments']()[0]; component['roomsByClass'].update((current) => ({ ...current, 'c-1': [...current['c-1'], { ...current['c-1'][0], id: 'room-b', name: 'Salle B' }] }));
    component['startChangingRoom'](enrollment); component['targetRoomId'] = 'room-b'; component['changeRoom'](enrollment);
    const request = http.expectOne(`${base}/school-years/year-1/enrollments/e-1`); expect(request.request.method).toBe('PATCH'); expect(request.request.body).toEqual({ classroomId: 'room-b' }); request.flush({ ...enrollment, classroomId: 'room-b' });
    expect(component['enrollments']()[0].id).toBe('e-1'); expect(component['enrollments']()[0].classroomId).toBe('room-b'); http.verify();
  });

  it('refuse un changement vers une salle pleine avant l’appel API', () => {
    TestBed.overrideProvider(WorkspaceAccessService, { useValue: { authorities: signal(['can_enrollment_update']) } });
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent); fixture.detectChanges();
    const enrollment = { id: 'e-1', establishmentId: 'school-1', studentId: 'st-1', academicYearId: 'year-1', schoolClassId: 'c-1', classroomId: 'room', advanceAccepted: false, paymentDecisionBy: null, createdAt: '' };
    flushAll(http, [enrollment]); fixture.detectChanges();
    const component = fixture.componentInstance;
    const fullRoom = { id: 'room-b', establishmentId: 'school-1', academicYearId: 'year-1', schoolClassId: 'c-1', code: 'B', name: 'Salle B', maxStudents: 1, enabled: true };
    component['roomsByClass'].update((current) => ({ ...current, 'c-1': [...current['c-1'], fullRoom] }));
    component['enrollments'].update((items) => [...items, { ...enrollment, id: 'e-2', studentId: 'st-2', classroomId: 'room-b' }]);
    component['targetRoomId'] = 'room-b'; component['changeRoom'](enrollment);

    http.expectNone(`${base}/school-years/year-1/enrollments/e-1`);
    expect(component['actionError']()).toContain('capacité maximale');
    http.verify();
  });

  it('recharge le parcours lors d’un changement d’année et ignore les anciennes requêtes', () => {
    const params = new BehaviorSubject(convertToParamMap({ establishmentId: 'school-1', academicYearId: 'year-1' }));
    TestBed.overrideProvider(ActivatedRoute, { useValue: { paramMap: params, queryParamMap: of(convertToParamMap({})) } });
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent); fixture.detectChanges();
    const old = http.match(() => true); expect(old.length).toBe(3);
    params.next(convertToParamMap({ establishmentId: 'school-1', academicYearId: 'year-2' })); fixture.detectChanges();
    expect(old.every((request) => request.cancelled)).toBeTrue();
    http.expectOne(`${base}/students`).flush([]); http.expectOne(`${base}/school-years/year-2/classes`).flush([]); http.expectOne(`${base}/school-years/year-2/enrollments`).flush([]); fixture.detectChanges();
    expect(fixture.componentInstance['academicYearId']()).toBe('year-2'); expect(fixture.componentInstance['enrollments']()).toEqual([]); http.verify();
  });
});
