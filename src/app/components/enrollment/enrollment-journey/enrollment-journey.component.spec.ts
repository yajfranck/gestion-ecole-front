import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { EnrollmentDraft } from '../../../models/enrollment/enrollment-draft.model';
import { ENROLLMENT_DRAFT_OWNER, ENROLLMENT_DRAFT_STORAGE, EnrollmentDraftService } from '../../../service/enrollment-draft-service/enrollment-draft.service';
import { PendingChangesService } from '../../../shared/pending-changes.service';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { EnrollmentJourneyComponent } from './enrollment-journey.component';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';

const student = { id: 'student', establishmentId: 'school', firstName: 'Ada', lastName: 'Lovelace', studentNumber: 'STU-1', enabled: true };
const schoolClass = { id: 'class', establishmentId: 'school', academicYearId: 'year', name: 'Sixième', code: '6', series: null, enabled: true };
const guardian = { id: 'guardian', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org' };
const room = { id: 'room', establishmentId: 'school', academicYearId: 'year', schoolClassId: 'class', name: 'Salle A', code: 'A', maxStudents: 40, enabled: true };

describe('EnrollmentJourneyComponent', () => {
  const base = `${environment.apiUrl}/establishments/school`;
  let http: HttpTestingController;
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    TestBed.configureTestingModule({
      imports: [EnrollmentJourneyComponent], providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        providePermissionFixture(['can_student_read', 'can_student_create', 'can_student_update', 'can_guardian_read', 'can_guardian_link', 'can_guardian_unlink', 'can_school_class_read', 'can_enrollment_read', 'can_enrollment_create', 'can_tuition_read', 'can_payment_record']),
        { provide: ENROLLMENT_DRAFT_OWNER, useValue: () => 'operator' },
        { provide: ENROLLMENT_DRAFT_STORAGE, useValue: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function setup(draft: EnrollmentDraft | null = null) {
    const fixture = TestBed.createComponent(EnrollmentJourneyComponent);
    fixture.componentRef.setInput('establishmentId', 'school');
    fixture.componentRef.setInput('academicYearId', 'year');
    fixture.componentRef.setInput('students', [student]);
    fixture.componentRef.setInput('classes', [schoolClass]);
    fixture.componentRef.setInput('draft', draft);
    fixture.detectChanges();
    return fixture;
  }
  function guardians(list: unknown[] = []) {
    http.expectOne(`${base}/students/student/guardians`).flush(list);
  }

  it('sauvegarde une identité incomplète sans créer d’élève ni encaisser', async () => {
    const fixture = setup();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input[name="studentFirstName"]') as HTMLInputElement;
    input.value = 'Ada'; input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    const closed = jasmine.createSpy('closed'); fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.saveAndClose();
    expect(closed).toHaveBeenCalled();
    const draft = TestBed.inject(EnrollmentDraftService).list('school', 'year')[0];
    expect(draft.identity).toEqual({ firstName: 'Ada', lastName: '' });
    expect(draft.studentId).toBeNull();
    http.expectNone(request => request.method === 'POST');
    fixture.destroy();
    const resumed = setup(draft); await resumed.whenStable();
    expect((resumed.nativeElement.querySelector('input[name="studentFirstName"]') as HTMLInputElement).value).toBe('Ada');
  });

  it('enregistre l’élève dans le parcours puis reprend au tuteur sans recréer la fiche', async () => {
    const fixture = setup(); await fixture.whenStable();
    const closed = jasmine.createSpy('closed'); fixture.componentInstance.closed.subscribe(closed);
    for (const [name, value] of [['studentFirstName', ' Ada '], ['studentLastName', ' Lovelace ']]) {
      const input = fixture.nativeElement.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
    fixture.nativeElement.querySelector('app-student-form form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const call = http.expectOne(`${base}/students`);
    expect(call.request.body).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    fixture.detectChanges();
    fixture.componentInstance.saveAndClose();
    expect(TestBed.inject(PendingChangesService).saving()).toBeTrue();
    expect(closed).not.toHaveBeenCalled();
    call.flush(student); fixture.detectChanges(); guardians(); fixture.detectChanges();
    fixture.componentInstance.saveAndClose();
    expect(closed).toHaveBeenCalled();
    const draft = TestBed.inject(EnrollmentDraftService).list('school', 'year')[0];
    expect(draft.studentId).toBe('student'); expect(draft.step).toBe(2);
    fixture.destroy();
    const resumed = setup(draft); guardians([guardian]); resumed.detectChanges();
    http.expectNone(request => request.method === 'POST');
    expect(resumed.componentInstance['guardianReady']()).toBeTrue();
  });

  it('revérifie les tuteurs à la reprise au lieu de faire confiance à une étape locale', () => {
    const store = TestBed.inject(EnrollmentDraftService);
    const draft = store.create('school', 'year'); draft.studentId = 'student'; draft.step = 3;
    const fixture = setup(draft); guardians([]); fixture.detectChanges();
    expect(fixture.componentInstance['step']()).toBe(2);
    expect(fixture.componentInstance['guardianReady']()).toBeFalse();
    http.expectNone(request => request.url.includes('/enrollments') || request.url.includes('/tuition-fees'));
  });

  it('bloque la fermeture si le brouillon ne peut pas être enregistré', async () => {
    const fixture = setup(); await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input[name="studentFirstName"]') as HTMLInputElement;
    input.value = 'Ada'; input.dispatchEvent(new Event('input', { bubbles: true }));
    spyOn(TestBed.inject(EnrollmentDraftService), 'save').and.returnValue(false);
    const closed = jasmine.createSpy('closed'); fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.saveAndClose();
    expect(closed).not.toHaveBeenCalled();
    expect(fixture.componentInstance['storageError']()).toContain('indisponible');
    expect(TestBed.inject(PendingChangesService).dirty()).toBeTrue();
  });

  it('ne réutilise pas une fiche archivée, inconnue ou déjà inscrite', () => {
    const draft = TestBed.inject(EnrollmentDraftService).create('school', 'year'); draft.studentId = 'absent'; draft.step = 3;
    const fixture = setup(draft);
    expect(fixture.componentInstance['unavailable']()).toBeTrue();
    expect(fixture.componentInstance['student']()).toBeNull();
    http.expectNone(request => request.method === 'POST');
  });

  it('conserve le tuteur après un refus serveur sans recréer l’élève ni préparer de paiement', async () => {
    const draft = TestBed.inject(EnrollmentDraftService).create('school', 'year'); draft.studentId = 'student'; draft.step = 2;
    const fixture = setup(draft); guardians([]); fixture.detectChanges(); await fixture.whenStable();
    const fields = [...fixture.nativeElement.querySelectorAll('app-student-guardians input')] as HTMLInputElement[];
    for (const [index, value] of ['Grace', 'Hopper', 'grace@example.org'].entries()) { fields[index].value = value; fields[index].dispatchEvent(new Event('input', { bubbles: true })); }
    await fixture.whenStable();
    fixture.nativeElement.querySelector('app-student-guardians form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http.expectOne(`${base}/students/student/guardians`).flush({}, { status: 503, statusText: 'Service Unavailable' }); fixture.detectChanges();
    expect(fixture.componentInstance.saving()).toBeFalse();
    expect(fixture.componentInstance['guardianReady']()).toBeFalse();
    fixture.componentInstance.saveAndClose();
    expect(TestBed.inject(EnrollmentDraftService).list('school', 'year')[0].guardian.email).toBe('grace@example.org');
    http.expectNone(request => request.method === 'POST' || request.url.includes('/tuition-fees'));
  });

  it('ne crée l’inscription qu’après vérification des frais et retire le brouillon après succès', async () => {
    const store = TestBed.inject(EnrollmentDraftService);
    const draft = store.create('school', 'year'); draft.studentId = 'student'; draft.step = 3;
    draft.selection.schoolClassId = 'class';
    store.save(draft);
    const fixture = setup(draft); guardians([guardian]); fixture.detectChanges();
    http.expectOne(`${base}/school-years/year/classes/class/classrooms`).flush([room]); fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('footer .btn-primary').click();
    http.expectOne(`${base}/school-years/year/tuition-fees`).flush([]); fixture.detectChanges();
    await fixture.whenStable();
    http.expectNone(request => request.method === 'POST');
    fixture.nativeElement.querySelector('app-enrollment-form form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); fixture.detectChanges();
    await fixture.whenStable();
    expect([...fixture.nativeElement.querySelectorAll('footer button')].map((button: unknown) => (button as HTMLButtonElement).textContent?.trim())).toEqual(['Étape précédente', 'Terminer']);
    fixture.nativeElement.querySelector('footer .btn-secondary').click(); fixture.detectChanges(); await fixture.whenStable();
    expect([...fixture.nativeElement.querySelectorAll('footer button')].map((button: unknown) => (button as HTMLButtonElement).textContent?.trim())).toEqual(['Étape précédente', 'Enregistrer et quitter', 'Enregistrer et continuer']);
    http.expectNone(request => request.method === 'POST');
    fixture.nativeElement.querySelector('footer .btn-primary').click(); fixture.detectChanges(); await fixture.whenStable();
    const created = jasmine.createSpy('created'); fixture.componentInstance.created.subscribe(created);
    fixture.nativeElement.querySelector('footer .btn-primary').click();
    const call = http.expectOne(`${base}/school-years/year/enrollments`);
    expect(call.request.body).toEqual({ studentId: 'student', schoolClassId: 'class', classroomId: 'room', acceptAdvance: false, payments: [] });
    const result = { id: 'enrollment', establishmentId: 'school', academicYearId: 'year', studentId: 'student', schoolClassId: 'class', classroomId: 'room', advanceAccepted: false, paymentDecisionBy: 'operator', createdAt: '', payments: [] };
    call.flush(result); fixture.detectChanges();
    expect(created).toHaveBeenCalledWith(result);
    expect(store.list('school', 'year')).toEqual([]);
  });

  it('revient modifier l’identité, reprend la correction après une pause et conserve l’affectation et le versement', async () => {
    const store = TestBed.inject(EnrollmentDraftService);
    const draft = store.create('school', 'year'); draft.studentId = student.id; draft.step = 3;
    draft.identity = { firstName: student.firstName, lastName: student.lastName };
    draft.selection = { schoolClassId: 'class', classroomId: 'room', phase: 2, acceptAdvance: true, payments: [{ feeId: 'fee', amount: 35, method: 'CASH', reference: 'AC-001' }] };
    function fees() {
      http.expectOne(`${base}/school-years/year/classes/class/classrooms`).flush([room]);
      http.expectOne(`${base}/school-years/year/tuition-fees`).flush([{ id: 'fee', establishmentId: 'school', academicYearId: 'year', name: 'Inscription', scope: 'ACADEMIC_YEAR', amount: 100, currency: 'XOF' }]);
      http.expectOne(`${base}/school-years/year/students/student/tuition-fees`).flush([]);
      http.expectOne(`${base}/payment-methods`).flush([{ code: 'CASH', name: 'Espèces' }]);
    }
    const fixture = setup(draft); guardians([guardian]); fixture.detectChanges(); fees(); fixture.detectChanges(); await fixture.whenStable();
    function previous(element: HTMLElement) { [...element.querySelectorAll<HTMLButtonElement>('footer button')].find(button => button.textContent?.trim() === 'Étape précédente')!.click(); }
    fixture.componentInstance['navigate'](2); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input[name^="guardianFirstName"]').value).toBe('Grace');
    http.expectNone(request => request.method === 'GET');
    previous(fixture.nativeElement); fixture.detectChanges(); await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input[name="studentFirstName"]') as HTMLInputElement;
    expect(input.value).toBe('Ada');
    input.value = 'Augusta'; input.dispatchEvent(new Event('input', { bubbles: true })); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button[aria-label="Parent ou tuteur"]').disabled).toBeTrue();
    fixture.componentInstance['navigate'](3); expect(fixture.componentInstance['step']()).toBe(1);
    fixture.componentInstance.saveAndClose();
    const saved = store.list('school', 'year')[0];
    expect(saved.identity.firstName).toBe('Augusta'); expect(saved.step).toBe(1); expect(saved.selection).toEqual(draft.selection);
    fixture.destroy();
    const resumed = setup(saved); await resumed.whenStable();
    expect(resumed.nativeElement.querySelector('input[name="studentFirstName"]').value).toBe('Augusta');
    http.expectNone(request => request.method === 'PATCH' || request.method === 'POST');
    resumed.nativeElement.querySelector('app-student-form form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const call = http.expectOne(`${base}/students/student`); expect(call.request.method).toBe('PATCH'); expect(call.request.body).toEqual({ firstName: 'Augusta' });
    resumed.componentInstance['navigate'](3); expect(resumed.componentInstance['step']()).toBe(1);
    call.flush({ ...student, firstName: 'Augusta' }); resumed.detectChanges();
    http.expectOne(`${base}/students/student/guardians`).flush([guardian]); resumed.detectChanges();
    resumed.componentInstance['navigate'](3); resumed.detectChanges(); fees(); resumed.detectChanges(); await resumed.whenStable();
    expect(resumed.nativeElement.querySelector('input[type="number"]').value).toBe('35');
    expect(resumed.nativeElement.querySelector('input[maxlength="120"]').value).toBe('AC-001');
    expect(resumed.nativeElement.textContent).toContain('Augusta Lovelace');
    expect(resumed.componentInstance['student']()?.studentNumber).toBe('STU-1');
    http.expectNone(request => request.method === 'POST' || request.method === 'PATCH');
  });

  it('laisse consulter l’étape précédente sans autorisation de modifier l’identité', async () => {
    const access = TestBed.inject(WorkspaceAccessService);
    const hasPermission = access.hasPermission.bind(access);
    spyOn(access, 'hasPermission').and.callFake((permission, id) => permission !== 'can_student_update' && hasPermission(permission, id));
    const draft = TestBed.inject(EnrollmentDraftService).create('school', 'year'); draft.studentId = student.id; draft.step = 2;
    const fixture = setup(draft); guardians([guardian]); fixture.detectChanges();
    fixture.componentInstance['navigate'](1); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-student-form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Votre compte ne permet pas de modifier l’identité');
    fixture.componentInstance['navigate'](2); fixture.detectChanges();
    http.expectNone(request => request.method === 'GET');
    expect(fixture.componentInstance['step']()).toBe(2);
    http.expectNone(request => request.method === 'POST' || request.method === 'PATCH');
  });

  it('restitue les données et les corrections sur plusieurs retours sans rappeler les API', async () => {
    const draft = TestBed.inject(EnrollmentDraftService).create('school', 'year');
    draft.studentId = student.id; draft.step = 3;
    draft.selection = { schoolClassId: 'class', classroomId: 'room', phase: 2, acceptAdvance: true, payments: [{ feeId: 'fee', amount: 35, method: 'CASH', reference: 'AC-001' }] };
    const fixture = setup(draft); guardians([guardian]); fixture.detectChanges();
    http.expectOne(`${base}/school-years/year/classes/class/classrooms`).flush([room]);
    http.expectOne(`${base}/school-years/year/tuition-fees`).flush([{ id: 'fee', establishmentId: 'school', academicYearId: 'year', name: 'Inscription', scope: 'ACADEMIC_YEAR', amount: 100, currency: 'XOF' }]);
    http.expectOne(`${base}/school-years/year/students/student/tuition-fees`).flush([]);
    http.expectOne(`${base}/payment-methods`).flush([{ code: 'CASH', name: 'Espèces' }]);
    fixture.detectChanges(); await fixture.whenStable();
    for (let round = 0; round < 3; round++) {
      fixture.componentInstance['navigate'](2); fixture.detectChanges(); await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('input[name^="guardianFirstName"]').value).toBe('Grace');
      fixture.componentInstance['navigate'](1); fixture.detectChanges(); await fixture.whenStable();
      const firstName = fixture.nativeElement.querySelector('input[name="studentFirstName"]') as HTMLInputElement;
      expect(firstName.value).toBe(round === 0 ? 'Ada' : 'Augusta');
      if (round === 0) {
        firstName.value = 'Augusta'; firstName.dispatchEvent(new Event('input', { bubbles: true })); await fixture.whenStable();
      }
      fixture.nativeElement.querySelector('app-student-form form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      if (round === 0) http.expectOne(`${base}/students/student`).flush({ ...student, firstName: 'Augusta' });
      fixture.detectChanges(); await fixture.whenStable();
      expect(fixture.componentInstance['student']()?.firstName).toBe('Augusta');
      fixture.componentInstance['navigate'](3); fixture.detectChanges(); await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('input[type="number"]').value).toBe('35');
      expect(fixture.nativeElement.querySelector('input[maxlength="120"]').value).toBe('AC-001');
      expect(fixture.nativeElement.querySelector('input[name="acceptAdvance"]').checked).toBeTrue();
      http.expectNone(() => true);
    }
    // Le retour à l’affectation puis au règlement réutilise également les frais.
    fixture.nativeElement.querySelector('footer .btn-secondary').click(); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('select[name="enrollmentClassId"]').value).toBe('class');
    expect(fixture.nativeElement.querySelector('select[name="enrollmentClassroomId"]').value).toBe('room');
    fixture.nativeElement.querySelector('app-enrollment-form form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input[type="number"]').value).toBe('35');
    http.expectNone(() => true);
  });

  it('permet de corriger les liens de tuteurs avec confirmation et bloque la suite si le dernier lien est retiré', async () => {
    const draft = TestBed.inject(EnrollmentDraftService).create('school', 'year'); draft.studentId = student.id; draft.step = 2;
    const fixture = setup(draft); guardians([guardian]); fixture.detectChanges();
    const confirmation = spyOn(TestBed.inject(ConfirmationDialogService), 'confirm').and.stub();
    fixture.nativeElement.querySelector('button[aria-label="Supprimer le tuteur 1"]').click();
    expect(confirmation).toHaveBeenCalled(); http.expectNone(request => request.method === 'DELETE');
    confirmation.calls.mostRecent().args[1]();
    expect(fixture.componentInstance.saving()).toBeTrue();
    fixture.componentInstance['navigate'](1); expect(fixture.componentInstance['step']()).toBe(2);
    http.expectOne(`${base}/students/student/guardians/guardian`).flush(null);
    fixture.detectChanges();
    expect(fixture.componentInstance.saving()).toBeFalse();
    expect(fixture.componentInstance['guardianReady']()).toBeFalse();
    fixture.componentInstance['navigate'](3); expect(fixture.componentInstance['step']()).toBe(2);
    fixture.componentInstance['navigate'](1); fixture.detectChanges();
    fixture.componentInstance['navigate'](2); fixture.detectChanges();
    expect(fixture.componentInstance['guardianReady']()).toBeFalse();
    http.expectNone(request => request.method === 'GET');
    http.expectNone(request => request.method === 'POST' || request.method === 'PATCH');
  });

  it('conserve plusieurs lignes de tuteurs après une pause puis les enregistre depuis les trois actions communes', async () => {
    const store = TestBed.inject(EnrollmentDraftService);
    const draft = store.create('school', 'year'); draft.studentId = student.id; draft.step = 2;
    const fixture = setup(draft); guardians([]); fixture.detectChanges(); await fixture.whenStable();
    async function fill(element: HTMLElement, firstName: string, lastName: string, email: string) {
      const inputs = [...element.querySelectorAll<HTMLInputElement>('app-guardian-form input:not([readonly])')].slice(-3);
      [firstName, lastName, email].forEach((value, index) => { inputs[index].value = value; inputs[index].dispatchEvent(new Event('input', { bubbles: true })); });
      await fixture.whenStable();
    }
    const footer = fixture.nativeElement.querySelector('app-enrollment-journey > div > footer, footer') as HTMLElement;
    expect([...footer.querySelectorAll('button')].map(button => button.textContent?.trim())).toEqual(['Étape précédente', 'Enregistrer et quitter', 'Enregistrer et continuer']);
    await fill(fixture.nativeElement, 'Grace', 'Hopper', 'grace@example.org');
    const add = [...fixture.nativeElement.querySelectorAll('app-guardian-form button')] as HTMLButtonElement[];
    add.find(button => button.textContent?.trim() === 'Ajouter un tuteur')!.click(); fixture.detectChanges(); await fixture.whenStable();
    await fill(fixture.nativeElement, 'Marie', 'Diallo', 'marie@example.org');
    fixture.componentInstance.saveAndClose(); const saved = store.list('school', 'year')[0]; fixture.destroy();
    expect(saved.guardians?.length).toBe(2);
    const resumed = setup(saved); guardians([]); resumed.detectChanges(); await resumed.whenStable();
    expect([...resumed.nativeElement.querySelectorAll('app-guardian-form input')].map((input: unknown) => (input as HTMLInputElement).value)).toEqual(['Grace', 'Hopper', 'grace@example.org', 'Marie', 'Diallo', 'marie@example.org']);
    resumed.nativeElement.querySelector('footer .btn-primary').click();
    const first = http.expectOne(`${base}/students/student/guardians`); expect(first.request.body.email).toBe('grace@example.org'); first.flush({ guardian, accessStatus: 'INVITATION_SENT' });
    const second = http.expectOne(`${base}/students/student/guardians`); expect(second.request.body.email).toBe('marie@example.org'); second.flush({ guardian: { id: 'other', firstName: 'Marie', lastName: 'Diallo', email: 'marie@example.org' }, accessStatus: 'INVITATION_SENT' });
    resumed.detectChanges(); await resumed.whenStable();
    expect(resumed.componentInstance['step']()).toBe(3); expect(resumed.componentInstance.saving()).toBeFalse();
    resumed.nativeElement.querySelector('footer .btn-secondary').click(); resumed.detectChanges(); await resumed.whenStable();
    expect(resumed.componentInstance['step']()).toBe(2); expect(resumed.nativeElement.querySelectorAll('app-guardian-form input').length).toBe(6);
    http.expectNone(() => true);
  });
});
