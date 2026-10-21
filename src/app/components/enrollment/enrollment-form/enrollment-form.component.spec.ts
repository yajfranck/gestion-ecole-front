import { withPermissionChecks } from '../../../testing/permission-fixture';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { EnrollmentFormComponent } from './enrollment-form.component';
import { ClassroomService } from '../../../service/classroom-service/classroom.service';
import { EnrollmentService } from '../../../service/enrollment-service/enrollment.service';
import { TuitionService } from '../../../service/tuition-service/tuition.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PendingChangesService } from '../../../shared/pending-changes.service';
import { Classroom } from '../../../models/classroom/classroom.model';
import { EnrollmentCreation } from '../../../models/enrollment/enrollment.model';

const room = { id: 'room', establishmentId: 'school', academicYearId: 'year', schoolClassId: 'class', code: 'A', name: 'Sixième A', maxStudents: 40, enabled: true };
const fee = { id: 'fee', establishmentId: 'school', academicYearId: 'year', name: 'Scolarité', scope: 'ACADEMIC_YEAR', schoolClassIds: [], studentId: null, amount: 100, currency: 'XOF' };
const created = { id: 'enrollment', studentId: 'student', schoolClassId: 'class', classroomId: 'room', payments: [{ id: 'payment', receiptNumber: 'REC-1' }] };

describe('EnrollmentFormComponent', () => {
  const rooms = jasmine.createSpyObj('ClassroomService', ['list']);
  const tuition = jasmine.createSpyObj('TuitionService', ['getTuitionFees', 'getStudentCharges', 'getPaymentMethods']);
  const api = jasmine.createSpyObj('EnrollmentService', ['createEnrollment']);
  const access = { authorities: signal(['can_tuition_read', 'can_enrollment_create', 'can_payment_record']), has: (permission: string) => access.authorities().includes(permission), hasPermission: (permission: string) => access.authorities().includes(permission) };
  beforeEach(() => {
    for (const object of [rooms, tuition, api]) for (const method of Object.values(object)) (method as jasmine.Spy).calls.reset();
    rooms.list.and.returnValue(of([room])); tuition.getTuitionFees.and.returnValue(of([fee])); tuition.getStudentCharges.and.returnValue(of([])); tuition.getPaymentMethods.and.returnValue(of([{ code: 'CASH', name: 'Espèces' }])); api.createEnrollment.and.returnValue(of(created)); access.authorities.set(['can_tuition_read', 'can_enrollment_create', 'can_payment_record']);
    TestBed.configureTestingModule({ imports: [EnrollmentFormComponent], providers: [provideZonelessChangeDetection(), { provide: ClassroomService, useValue: rooms }, { provide: TuitionService, useValue: tuition }, { provide: EnrollmentService, useValue: api }, { provide: WorkspaceAccessService, useValue: withPermissionChecks(access) }] });
  });
  async function create() {
    const fixture = TestBed.createComponent(EnrollmentFormComponent);
    fixture.componentRef.setInput('establishmentId', 'school'); fixture.componentRef.setInput('academicYearId', 'year');
    fixture.componentRef.setInput('students', [{ id: 'student', establishmentId: 'school', firstName: 'Ada', lastName: 'Exemple', enabled: true }]);
    fixture.componentRef.setInput('classes', [{ id: 'class', establishmentId: 'school', academicYearId: 'year', name: 'Sixième', enabled: true }, { id: 'other-class', establishmentId: 'school', academicYearId: 'year', name: 'Autre', enabled: true }]);
    fixture.detectChanges(); await fixture.whenStable();
    const component = fixture.componentInstance; component['studentId'] = 'student'; component['schoolClassId'] = 'class'; component['selectionChanged'](true); fixture.detectChanges(); await fixture.whenStable();
    return fixture;
  }
  it('sélectionne une salle unique et envoie le règlement seulement après vérification et confirmation', async () => {
    const fixture = await create(); const component = fixture.componentInstance; const emitted: EnrollmentCreation[] = [];
    component.created.subscribe((value) => emitted.push(value)); expect(component['classroomId']).toBe('room');
    component['prepare'](); expect(component['step']()).toBe(2); expect(api.createEnrollment).not.toHaveBeenCalled();
    component['review'](); expect(component['step']()).toBe(3); expect(api.createEnrollment).not.toHaveBeenCalled();
    component['confirm'](); expect(api.createEnrollment).toHaveBeenCalledOnceWith('school', 'year', { studentId: 'student', schoolClassId: 'class', classroomId: 'room', acceptAdvance: false, payments: [{ feeId: 'fee', amount: 100, paymentMethodCode: 'CASH' }] });
    expect(emitted[0].payments[0].receiptNumber).toBe('REC-1'); expect(component['step']()).toBe(1); expect(TestBed.inject(PendingChangesService).dirty()).toBeFalse();
  });
  it('exige un choix explicite lorsque plusieurs salles sont actives', async () => {
    rooms.list.and.returnValue(of([room, { ...room, id: 'room-b', name: 'Sixième B' }])); const fixture = await create(); const component = fixture.componentInstance;
    expect(component['classroomId']).toBe(''); component['prepare'](); expect(tuition.getTuitionFees).not.toHaveBeenCalled();
    component['classroomId'] = 'room-b'; component['prepare'](); expect(component['step']()).toBe(2);
  });
  it('refuse une classe sans salle active', async () => {
    rooms.list.and.returnValue(of([])); const fixture = await create(); fixture.componentInstance['prepare'](); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('aucune salle active'); expect(tuition.getTuitionFees).not.toHaveBeenCalled();
  });
  it('bloque une inscription lorsque la salle a atteint sa capacité', async () => {
    const fixture = await create();
    fixture.componentRef.setInput('enrollments', Array.from({ length: 40 }, (_, index) => ({
      id: `enrollment-${index}`, establishmentId: 'school', studentId: `other-${index}`,
      academicYearId: 'year', schoolClassId: 'class', classroomId: 'room',
      advanceAccepted: false, paymentDecisionBy: null, createdAt: ''
    })));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.componentInstance['studentId'] = 'student';
    fixture.componentInstance['schoolClassId'] = 'class';
    fixture.componentInstance['selectionChanged'](true);
    fixture.detectChanges();

    fixture.componentInstance['prepare']();

    expect(tuition.getTuitionFees).not.toHaveBeenCalled();
    expect(fixture.componentInstance['error']()).toContain('capacité maximale');
    expect(fixture.nativeElement.textContent).toContain('40/40 élèves');
  });
  it('ne conserve pas les salles d’une classe précédente lors de réponses tardives', async () => {
    const response = new Subject<Classroom[]>(); rooms.list.and.returnValue(response); const fixture = await create();
    rooms.list.and.returnValue(of([{ ...room, id: 'other-room', schoolClassId: 'other-class' }])); const component = fixture.componentInstance; component['schoolClassId'] = 'other-class'; component['selectionChanged'](true);
    response.next([room]); expect(component['classroomId']).toBe('other-room'); expect(component['rooms']()[0].id).toBe('other-room');
  });
  it('permet une inscription sans versement lorsqu’aucun frais ne s’applique', async () => {
    access.authorities.set(['can_enrollment_create', 'can_tuition_read']); tuition.getTuitionFees.and.returnValue(of([])); const fixture = await create(); const component = fixture.componentInstance;
    component['prepare'](); component['review'](); component['confirm']();
    expect(tuition.getStudentCharges).not.toHaveBeenCalled(); expect(tuition.getPaymentMethods).not.toHaveBeenCalled(); expect(api.createEnrollment.calls.mostRecent().args[2].payments).toEqual([]);
  });
  it('inclut les frais de toutes les portées applicables et exclut ceux d’un autre élève, année ou classe', async () => {
    tuition.getTuitionFees.and.returnValue(of([fee, { ...fee, id: 'multi', scope: 'SCHOOL_CLASS', schoolClassIds: ['class', 'other-class'], currency: 'EUR' }, { ...fee, id: 'own', scope: 'STUDENT', studentId: 'student' }, { ...fee, id: 'foreign', scope: 'STUDENT', studentId: 'other' }, { ...fee, id: 'other', scope: 'SCHOOL_CLASS', schoolClassIds: ['other-class'] }, { ...fee, id: 'old', academicYearId: 'old-year' }]));
    const fixture = await create(); fixture.componentInstance['prepare'](); expect(fixture.componentInstance['lines']().map((line) => line.fee.id)).toEqual(['fee', 'multi', 'own']);
  });
  it('déduit les paiements antérieurs sans réencaisser un frais déjà soldé', async () => {
    tuition.getStudentCharges.and.returnValue(of([{ feeId: 'fee', studentId: 'student', establishmentId: 'school', academicYearId: 'year', totalPaid: 100, balance: 0 }])); const fixture = await create(); const component = fixture.componentInstance;
    component['prepare'](); component['review'](); component['confirm'](); expect(api.createEnrollment.calls.mostRecent().args[2].payments).toEqual([]);
  });
  it('refuse un versement partiel sans acceptation explicite, puis accepte une avance positive', async () => {
    const fixture = await create(); const component = fixture.componentInstance; component['prepare'](); component['lines']()[0].amount = 25;
    component['review'](); expect(component['step']()).toBe(2); expect(component['error']()).toContain('avance');
    component['acceptAdvance'] = true; component['review'](); component['confirm'](); expect(api.createEnrollment.calls.mostRecent().args[2]).toEqual(jasmine.objectContaining({ acceptAdvance: true, payments: [{ feeId: 'fee', amount: 25, paymentMethodCode: 'CASH' }] }));
  });
  it('ne permet pas une avance sans paiement positif', async () => {
    const fixture = await create(); const component = fixture.componentInstance; component['prepare'](); component['lines']()[0].amount = 0; component['acceptAdvance'] = true; component['review'](); component['confirm'](); expect(api.createEnrollment).not.toHaveBeenCalled(); expect(component['step']()).toBe(2);
  });
  it('réutilise un versement antérieur positif pour la décision d’avance', async () => {
    tuition.getStudentCharges.and.returnValue(of([{ feeId: 'fee', studentId: 'student', establishmentId: 'school', academicYearId: 'year', totalPaid: 20, balance: 80 }])); const fixture = await create(); const component = fixture.componentInstance;
    component['prepare'](); expect(component['lines']()[0].balance).toBe(80); component['lines']()[0].amount = 0; component['acceptAdvance'] = true; component['review'](); component['confirm'](); expect(api.createEnrollment.calls.mostRecent().args[2].payments).toEqual([]);
  });
  for (const amount of [-1, 100.01, 0.001, 10000000000]) {
    it(`refuse le montant invalide ${amount}`, async () => {
      const fixture = await create(); const component = fixture.componentInstance; component['prepare'](); component['lines']()[0].amount = amount; component['review'](); expect(component['step']()).toBe(2); expect(api.createEnrollment).not.toHaveBeenCalled();
    });
  }
  it('refuse un encaissement sans permission', async () => {
    access.authorities.set(['can_enrollment_create', 'can_tuition_read']); const fixture = await create(); const component = fixture.componentInstance; component['prepare'](); component['review'](); expect(component['error']()).toContain('permission d’encaisser'); expect(component['step']()).toBe(2);
  });
  it('conserve tous les versements après ENROLLMENT_PAYMENT_REQUIRED et permet une correction', async () => {
    api.createEnrollment.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'ENROLLMENT_PAYMENT_REQUIRED', unpaidFeeIds: ['fee'] } })));
    const fixture = await create(); const component = fixture.componentInstance; component['prepare'](); component['lines']()[0].reference = ' REF '; component['review'](); component['confirm']();
    expect(component['step']()).toBe(2); expect(component['unpaidFeeIds']()).toEqual(['fee']); expect(component['lines']()[0].amount).toBe(100); expect(component['error']()).toContain('Aucun paiement ni inscription'); expect(TestBed.inject(PendingChangesService).dirty()).toBeTrue();
    api.createEnrollment.and.returnValue(of(created)); component['review'](); component['confirm'](); expect(api.createEnrollment.calls.mostRecent().args[2].payments[0].reference).toBe('REF');
  });
  it('bloque les doubles confirmations et protège la navigation pendant l’enregistrement', async () => {
    const response = new Subject<EnrollmentCreation>(); api.createEnrollment.and.returnValue(response); const fixture = await create(); const component = fixture.componentInstance; component['prepare'](); component['review'](); component['confirm'](); component['confirm']();
    expect(api.createEnrollment).toHaveBeenCalledTimes(1); expect(TestBed.inject(PendingChangesService).confirmLeave()).toBeFalse(); const event = new Event('beforeunload', { cancelable: true }); component.beforeUnload(event as BeforeUnloadEvent); expect(event.defaultPrevented).toBeTrue();
  });

  it('actualise une grille modifiée en conservant tous les versements saisis', async () => {
    const fixture = await create(); const component = fixture.componentInstance; component['prepare'](); component['lines']()[0].amount = 25; component['lines']()[0].reference = 'REF'; component['acceptAdvance'] = true;
    tuition.getTuitionFees.and.returnValue(of([fee, { ...fee, id: 'new-fee', name: 'Nouveau frais' }])); component['prepare'](true);
    expect(component['lines']().map((line) => [line.fee.id, line.amount])).toEqual([['fee', 25], ['new-fee', 100]]); expect(component['lines']()[0].reference).toBe('REF'); expect(component['acceptAdvance']).toBeTrue();
  });

  it('conserve le versement et sa référence après retour à l’affectation sans encaisser', async () => {
    const fixture = await create(); const component = fixture.componentInstance;
    component['prepare'](); component['lines']()[0].amount = 35; component['lines']()[0].reference = 'AC-001'; component['acceptAdvance'] = true;
    component['review'](); component['back'](); component['back']();
    expect(component['step']()).toBe(1);
    component['prepare']();
    expect(component['step']()).toBe(2);
    expect(component['lines']()[0].amount).toBe(35); expect(component['lines']()[0].reference).toBe('AC-001');
    expect(component['acceptAdvance']).toBeTrue(); expect(api.createEnrollment).not.toHaveBeenCalled();
  });

  it('reprend les montants d’un brouillon après une lecture à jour des frais sans rejouer un paiement', async () => {
    const fixture = await create();
    fixture.componentRef.setInput('initialStudentId', 'student');
    fixture.componentRef.setInput('initialSelection', { schoolClassId: 'class', classroomId: 'room', phase: 3, acceptAdvance: true,
      payments: [{ feeId: 'fee', amount: 35, method: 'CASH', reference: 'AC-001' }] });
    fixture.detectChanges(); await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(component['step']()).toBe(2);
    expect(component['lines']()[0].amount).toBe(35);
    expect(component['acceptAdvance']).toBeTrue();
    expect(tuition.getTuitionFees).toHaveBeenCalled();
    expect(api.createEnrollment).not.toHaveBeenCalled();
  });

  it('ne prépare aucun nouvel encaissement pour un frais déjà soldé entre deux reprises', async () => {
    tuition.getStudentCharges.and.returnValue(of([{ feeId: 'fee', studentId: 'student', academicYearId: 'year', establishmentId: 'school', balance: 0, totalPaid: 100 }]));
    const fixture = await create();
    fixture.componentRef.setInput('initialStudentId', 'student');
    fixture.componentRef.setInput('initialSelection', { schoolClassId: 'class', classroomId: 'room', phase: 2, acceptAdvance: false,
      payments: [{ feeId: 'fee', amount: 100, method: 'CASH', reference: 'Ancienne saisie' }] });
    fixture.detectChanges(); await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(component['lines']()[0].balance).toBe(0);
    expect(component['payments']()).toEqual([]);
    expect(component['validPayments']()).toBeTrue();
    expect(api.createEnrollment).not.toHaveBeenCalled();
  });
});
