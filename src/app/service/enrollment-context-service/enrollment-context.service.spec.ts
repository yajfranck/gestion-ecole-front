import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { createEnvironmentInjector, EnvironmentInjector, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { EnrollmentContextService } from './enrollment-context.service';

const student = { id: 'student', establishmentId: 'school', studentNumber: 'STU-1', firstName: 'Ada', lastName: 'Lovelace', enabled: true };
const guardian = { id: 'guardian', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org' };

describe('EnrollmentContextService', () => {
  const base = `${environment.apiUrl}/establishments/school`;
  let context: EnrollmentContextService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), EnrollmentContextService] });
    context = TestBed.inject(EnrollmentContextService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('réutilise le dossier connu puis la réponse du PATCH sans relire l’élève', () => {
    context.setStudent(student);
    const names: string[] = [];
    context.getStudent('school', 'student').subscribe(value => names.push(value.firstName));
    context.setStudent({ ...student, firstName: 'Augusta' });
    context.getStudent('school', 'student').subscribe(value => names.push(value.firstName));
    expect(names).toEqual(['Ada', 'Augusta']);
    http.expectNone(request => request.method === 'GET');
  });

  it('partage une lecture en cours entre formulaires puis restitue son résultat sans nouvelle requête', () => {
    const first = context.getGuardians('school', 'student').subscribe();
    first.unsubscribe();
    const lists: unknown[] = [];
    context.getGuardians('school', 'student').subscribe(value => lists.push(value));
    http.expectOne(`${base}/students/student/guardians`).flush([guardian]);
    context.getGuardians('school', 'student').subscribe(value => lists.push(value));
    expect(lists).toEqual([[guardian], [guardian]]);
    http.expectNone(request => request.method === 'GET');
  });

  it('répercute les liens ajoutés ou retirés en mémoire sans relecture', () => {
    context.getGuardians('school', 'student').subscribe();
    http.expectOne(`${base}/students/student/guardians`).flush([]);
    context.setGuardians('school', 'student', [guardian]);
    context.getGuardians('school', 'student').subscribe(value => expect(value).toEqual([guardian]));
    context.setGuardians('school', 'student', []);
    context.getGuardians('school', 'student').subscribe(value => expect(value).toEqual([]));
    http.expectNone(request => request.method === 'GET');
  });

  it('ne mémorise pas les erreurs et permet de réessayer la lecture', () => {
    const failed = jasmine.createSpy('failed');
    context.getGuardians('school', 'student').subscribe({ error: failed });
    http.expectOne(`${base}/students/student/guardians`).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(failed).toHaveBeenCalled();
    context.getGuardians('school', 'student').subscribe(value => expect(value).toEqual([guardian]));
    http.expectOne(`${base}/students/student/guardians`).flush([guardian]);
  });

  it('sépare les salles, années, établissements et élèves', () => {
    context.getClassrooms('school', 'year', 'class').subscribe();
    context.getClassrooms('school', 'year', 'other-class').subscribe();
    context.getClassrooms('school', 'other-year', 'class').subscribe();
    context.getClassrooms('other-school', 'year', 'class').subscribe();
    context.getGuardians('school', 'student').subscribe();
    context.getGuardians('school', 'other-student').subscribe();
    const requests = http.match(request => request.method === 'GET');
    expect(requests.length).toBe(6);
    expect(new Set(requests.map(request => request.request.url)).size).toBe(6);
    requests.forEach(request => request.flush([]));
    context.getClassrooms('school', 'year', 'class').subscribe();
    context.getGuardians('school', 'student').subscribe();
    http.expectNone(request => request.method === 'GET');
  });

  it('relit les données financières après demande explicite ou refus serveur', () => {
    function read(refresh = false) {
      context.getTuitionFees('school', 'year', refresh).subscribe();
      context.getStudentCharges('school', 'year', 'student', refresh).subscribe();
      context.getPaymentMethods('school', refresh).subscribe();
    }
    function flush() {
      const requests = http.match(request => request.method === 'GET');
      expect(requests.length).toBe(3); requests.forEach(request => request.flush([]));
    }
    read(); flush(); read(); http.expectNone(request => request.method === 'GET');
    read(true); flush();
    context.invalidatePayments('school', 'year', 'student'); read(); flush();
  });

  it('isole les parcours et annule les lectures en cours à leur destruction', () => {
    const first = createEnvironmentInjector([EnrollmentContextService], TestBed.inject(EnvironmentInjector));
    const second = createEnvironmentInjector([EnrollmentContextService], TestBed.inject(EnvironmentInjector));
    first.get(EnrollmentContextService).getGuardians('school', 'student').subscribe();
    http.expectOne(`${base}/students/student/guardians`).flush([guardian]);
    second.get(EnrollmentContextService).getGuardians('school', 'student').subscribe();
    const pending = http.expectOne(`${base}/students/student/guardians`);
    expect(pending.cancelled).toBeFalse();
    second.destroy(); expect(pending.cancelled).toBeTrue(); first.destroy();
  });
});
