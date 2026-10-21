import { withPermissionChecks } from '../../../testing/permission-fixture';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { EnrollmentWorkspaceComponent } from './enrollment-workspace.component';
import { ENROLLMENT_DRAFT_OWNER, ENROLLMENT_DRAFT_STORAGE, EnrollmentDraftService } from '../../../service/enrollment-draft-service/enrollment-draft.service';

describe('EnrollmentWorkspaceComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [EnrollmentWorkspaceComponent],
    providers: [providePermissionFixture(['can_student_read', 'can_school_class_read', 'can_enrollment_create', 'can_enrollment_read', 'can_enrollment_update', 'can_payment_record']),
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

  function draftStore(): EnrollmentDraftService {
    const values = new Map<string, string>();
    TestBed.overrideProvider(ENROLLMENT_DRAFT_OWNER, { useValue: () => 'operator' });
    TestBed.overrideProvider(ENROLLMENT_DRAFT_STORAGE, { useValue: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
    return TestBed.inject(EnrollmentDraftService);
  }

  it('inscrit des élèves du dossier établissement dans les classes de l’année', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent);
    fixture.detectChanges();
    flushAll(http);
    fixture.detectChanges();
    [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Nouvelle inscription')!.click();
    fixture.detectChanges();
    const existing = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent?.trim() === 'Dossier existant'); existing?.click(); fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Identité de l’élève');
    expect(text).toContain('Parent ou tuteur');
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
    http.expectNone(`${base}/students/st-1`);
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

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ada Lovelace');
    const hrefs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/establishments/school-1/students?studentId=st-1');
    expect(hrefs).toContain('/establishments/school-1/school-years/year-1/classes?classId=c-1');
    http.verify();
  });

  it('change la salle dans la même inscription sans renvoyer de paiement', () => {
    TestBed.overrideProvider(WorkspaceAccessService, { useValue: withPermissionChecks({ authorities: signal(['can_enrollment_read', 'can_enrollment_update', 'can_student_read', 'can_school_class_read']) }) });
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent); fixture.detectChanges();
    flushAll(http, [{ id: 'e-1', establishmentId: 'school-1', studentId: 'st-1', academicYearId: 'year-1', schoolClassId: 'c-1', classroomId: 'room' }]); fixture.detectChanges();
    const component = fixture.componentInstance; const enrollment = component['enrollments']()[0]; component['roomsByClass'].update((current) => ({ ...current, 'c-1': [...current['c-1'], { ...current['c-1'][0], id: 'room-b', name: 'Salle B' }] }));
    component['startChangingRoom'](enrollment); component['targetRoomId'] = 'room-b'; component['changeRoom'](enrollment);
    const request = http.expectOne(`${base}/school-years/year-1/enrollments/e-1`); expect(request.request.method).toBe('PATCH'); expect(request.request.body).toEqual({ classroomId: 'room-b' }); request.flush({ ...enrollment, classroomId: 'room-b' });
    expect(component['enrollments']()[0].id).toBe('e-1'); expect(component['enrollments']()[0].classroomId).toBe('room-b'); http.verify();
  });

  it('refuse un changement vers une salle pleine avant l’appel API', () => {
    TestBed.overrideProvider(WorkspaceAccessService, { useValue: withPermissionChecks({ authorities: signal(['can_enrollment_read', 'can_enrollment_update', 'can_student_read', 'can_school_class_read']) }) });
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

  it('conserve la nouvelle identité à la fermeture puis à la reprise sans recharger la page', async () => {
    TestBed.overrideProvider(WorkspaceAccessService, { useValue: withPermissionChecks({ authorities: signal(['can_student_read', 'can_student_update', 'can_school_class_read', 'can_enrollment_create', 'can_enrollment_read', 'can_guardian_read']) }) });
    TestBed.overrideProvider(ENROLLMENT_DRAFT_OWNER, { useValue: () => 'operator' });
    const storage = new Map<string, string>();
    TestBed.overrideProvider(ENROLLMENT_DRAFT_STORAGE, { useValue: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent); fixture.detectChanges(); flushAll(http); fixture.detectChanges();
    const store = TestBed.inject(EnrollmentDraftService);
    const draft = store.create('school-1', 'year-1'); draft.studentId = 'st-1'; draft.step = 1; draft.identity = { firstName: 'Ada', lastName: 'Lovelace' };
    const component = fixture.componentInstance;
    component['startJourney'](new Event('click'), draft); fixture.detectChanges(); await fixture.whenStable();
    const field = fixture.nativeElement.querySelector('input[name="studentFirstName"]') as HTMLInputElement;
    field.value = 'Augusta'; field.dispatchEvent(new Event('input', { bubbles: true })); await fixture.whenStable();
    fixture.nativeElement.querySelector('app-student-form form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const updated = { ...component['students']()[0], firstName: 'Augusta' };
    const patch = http.expectOne(`${base}/students/st-1`); expect(patch.request.method).toBe('PATCH'); patch.flush(updated); fixture.detectChanges();
    http.expectOne(`${base}/students/st-1/guardians`).flush([]); fixture.detectChanges();
    component['journey']()!.saveAndClose(); fixture.detectChanges();
    expect(component['journeyOpen']()).toBeFalse();
    expect(component['students']().filter(student => student.id === 'st-1')).toEqual([updated]);
    component['startJourney'](new Event('click'), store.list('school-1', 'year-1')[0]); fixture.detectChanges();
    http.expectOne(`${base}/students/st-1/guardians`).flush([]); fixture.detectChanges();
    expect(component['students']()[0].firstName).toBe('Augusta');
    expect(store.list('school-1', 'year-1')[0].identity.firstName).toBe('Augusta');
    http.expectNone(request => request.method === 'POST' || request.method === 'PATCH'); http.verify();
  });

  it('réunit les parcours en cours et terminés avec leur statut et les actions adaptées', async () => {
    TestBed.overrideProvider(WorkspaceAccessService, { useValue: withPermissionChecks({ authorities: signal(['can_student_read', 'can_student_create', 'can_school_class_read', 'can_enrollment_read', 'can_enrollment_create', 'can_enrollment_update']) }) });
    const store = draftStore();
    const pending = store.create('school-1', 'year-1'); pending.identity = { firstName: 'Maya', lastName: 'Diallo' }; pending.selection.schoolClassId = 'c-1'; store.save(pending);
    const oldDraft = store.create('school-1', 'year-1'); oldDraft.studentId = 'st-1'; oldDraft.identity = { firstName: 'Ada', lastName: 'Lovelace' }; store.save(oldDraft);
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent); fixture.detectChanges();
    flushAll(http, [{ id: 'e-1', establishmentId: 'school-1', studentId: 'st-1', academicYearId: 'year-1', schoolClassId: 'c-1', classroomId: 'room', createdAt: '2026-10-01T00:00:00Z', advanceAccepted: true, paymentDecisionBy: 'operator' }]); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('table').length).toBe(1);
    expect(root.querySelector('thead')!.textContent).toContain('Statut');
    expect(root.textContent).not.toContain('Inscriptions à reprendre'); expect(root.textContent).not.toContain('Inscriptions finalisées');
    const rows = [...root.querySelectorAll('tbody tr')]; expect(rows.length).toBe(2);
    const completed = rows.find(row => row.textContent?.includes('Ada Lovelace'))!;
    expect(completed.textContent).toContain('Terminé'); expect(completed.textContent).toContain('Avance acceptée'); expect(completed.textContent).not.toContain('Reprendre');
    const current = rows.find(row => row.textContent?.includes('Maya Diallo'))!;
    expect(current.textContent).toContain('En cours'); expect(current.textContent).toContain('Identité à compléter');
    current.querySelector<HTMLButtonElement>('app-table-actions > button')!.click(); fixture.detectChanges();
    current.querySelector<HTMLButtonElement>('button[appTableAction="resume"]')!.click(); fixture.detectChanges(); await fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('input[name="studentFirstName"]')!.value).toBe('Maya');
    http.expectNone(() => true); http.verify();
  });

  it('remplace les anciens brouillons de l’élève par sa ligne terminée dès la finalisation', () => {
    const store = draftStore();
    for (let index = 0; index < 2; index++) { const draft = store.create('school-1', 'year-1'); draft.studentId = 'st-1'; draft.identity = { firstName: 'Ada', lastName: 'Lovelace' }; store.save(draft); }
    const otherYear = store.create('school-1', 'other-year'); otherYear.identity.firstName = 'Autre année'; store.save(otherYear);
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent); fixture.detectChanges(); flushAll(http); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    fixture.componentInstance['enrollments'].set([{ id: 'e-1', establishmentId: 'school-1', studentId: 'st-1', academicYearId: 'year-1', schoolClassId: 'c-1', classroomId: 'room', createdAt: '2026-10-01T00:00:00Z', advanceAccepted: false, paymentDecisionBy: 'operator' }]); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('Terminé');
    expect(fixture.nativeElement.querySelector('tbody').textContent).not.toContain('Reprendre');
    expect(fixture.nativeElement.textContent).not.toContain('Autre année'); http.expectNone(() => true); http.verify();
  });

  it('affiche les brouillons du compte sans appeler la liste des inscriptions sans autorisation de lecture', () => {
    TestBed.overrideProvider(WorkspaceAccessService, { useValue: withPermissionChecks({ authorities: signal(['can_student_read', 'can_student_create', 'can_school_class_read']) }) });
    const store = draftStore(); const draft = store.create('school-1', 'year-1'); draft.identity.firstName = 'Maya'; store.save(draft);
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent); fixture.detectChanges();
    http.expectOne(`${base}/students`).flush([]); http.expectOne(`${base}/school-years/year-1/classes`).flush([]); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);
    expect(fixture.nativeElement.querySelector('tbody').textContent).toContain('En cours');
    expect(fixture.nativeElement.textContent).toContain('Votre compte ne permet pas de consulter les inscriptions terminées');
    http.expectNone(`${base}/school-years/year-1/enrollments`); http.verify();
  });
});
