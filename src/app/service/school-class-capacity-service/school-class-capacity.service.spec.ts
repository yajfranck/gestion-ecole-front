import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { WorkspaceAccessService } from '../../core/workspace-access.service';
import { providePermissionFixture } from '../../testing/permission-fixture';
import { SchoolClassCapacityService } from './school-class-capacity.service';

const room = { id: 'room-a', establishmentId: 'school', academicYearId: 'year', schoolClassId: 'a', enabled: true, code: 'A', name: 'Salle A', maxStudents: 10 };
const enrollment = { id: 'enrollment', establishmentId: 'school', academicYearId: 'year', schoolClassId: 'a', classroomId: room.id, studentId: 'student', advanceAccepted: false, paymentDecisionBy: null, createdAt: '' };

describe('SchoolClassCapacityService', () => {
  const base = `${environment.apiUrl}/establishments/school/school-years/year`;
  const roomsUrl = (id: string) => `${base}/classes/${id}/classrooms`;
  let http: HttpTestingController;
  let service: SchoolClassCapacityService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), providePermissionFixture(['can_school_class_read', 'can_enrollment_read']), SchoolClassCapacityService] });
    http = TestBed.inject(HttpTestingController); service = TestBed.inject(SchoolClassCapacityService);
  });
  afterEach(() => http.verify());

  it('calcule les inscriptions, salles actives et places disponibles avec une seule lecture annuelle', () => {
    service.load('school', 'year', ['a', 'b']);
    expect(service.indicators()['a'].enrolled).toBeNull(); expect(service.loading()).toBeTrue();
    http.expectOne(`${base}/enrollments`).flush([enrollment, { ...enrollment, id: 'second', studentId: 'student-2' }, { ...enrollment, id: 'foreign', establishmentId: 'other' }, { ...enrollment, id: 'old', academicYearId: 'old-year' }]);
    http.expectOne(roomsUrl('a')).flush([room, { ...room, id: 'room-b', maxStudents: 20 }, { ...room, id: 'disabled', enabled: false }, { ...room, id: 'foreign', schoolClassId: 'b' }]);
    http.expectOne(roomsUrl('b')).flush([]);
    expect(service.indicators()['a']).toEqual({ enrolled: 2, activeRooms: 2, capacity: 30, remaining: 28, loading: false, error: false, restricted: false });
    expect(service.indicators()['b'].enrolled).toBe(0); expect(service.indicators()['b'].activeRooms).toBe(0); expect(service.indicators()['b'].remaining).toBe(0);
    expect(service.loading()).toBeFalse(); http.expectNone(request => request.url.endsWith('/students'));
  });

  it('calcule la disponibilité par salle sans reporter un dépassement sur une autre salle', () => {
    service.load('school', 'year', ['a']);
    http.expectOne(`${base}/enrollments`).flush(Array.from({ length: 12 }, (_, i) => ({ ...enrollment, id: String(i), studentId: String(i) })));
    http.expectOne(roomsUrl('a')).flush([room, { ...room, id: 'empty-room', maxStudents: 5 }]);
    expect(service.indicators()['a'].enrolled).toBe(12); expect(service.indicators()['a'].remaining).toBe(5);
  });

  it('laisse les compteurs indisponibles après un échec et permet une reprise', () => {
    service.load('school', 'year', ['a', 'b']);
    http.expectOne(`${base}/enrollments`).flush({}, { status: 500, statusText: 'Error' });
    http.expectOne(roomsUrl('a')).flush([room]); http.expectOne(roomsUrl('b')).flush({}, { status: 500, statusText: 'Error' });
    expect(service.indicators()['a'].enrolled).toBeNull(); expect(service.indicators()['a'].remaining).toBeNull(); expect(service.indicators()['a'].activeRooms).toBe(1);
    expect(service.indicators()['b'].activeRooms).toBeNull(); expect(service.error()).toBeTrue(); expect(service.loading()).toBeFalse();
    service.load('school', 'year', ['a']); http.expectOne(`${base}/enrollments`).flush([]); http.expectOne(roomsUrl('a')).flush([room]);
    expect(service.error()).toBeFalse(); expect(service.indicators()['a'].remaining).toBe(10);
  });

  it('actualise les capacités sans qu’une lecture ancienne écrase les données de la modale', () => {
    service.load('school', 'year', ['a']); http.expectOne(`${base}/enrollments`).flush([enrollment]);
    const previousRead = http.expectOne(roomsUrl('a'));
    service.setClassrooms('a', [{ ...room, maxStudents: 20 }]);
    previousRead.flush([room]);
    expect(service.indicators()['a'].capacity).toBe(20); expect(service.indicators()['a'].remaining).toBe(19);
    service.setClassrooms('a', []); expect(service.indicators()['a'].activeRooms).toBe(0); expect(service.indicators()['a'].remaining).toBe(0);
  });

  it('respecte les permissions sans afficher de faux zéros', () => {
    spyOn(TestBed.inject(WorkspaceAccessService), 'hasPermission').and.callFake(permission => permission === 'can_school_class_read');
    service.load('school', 'year', ['a']); http.expectOne(roomsUrl('a')).flush([room]);
    http.expectNone(`${base}/enrollments`);
    expect(service.indicators()['a'].enrolled).toBeNull(); expect(service.indicators()['a'].remaining).toBeNull(); expect(service.indicators()['a'].restricted).toBeTrue();
    expect(service.indicators()['a'].activeRooms).toBe(1);
  });

  it('annule les lectures d’un ancien contexte et ne consulte rien sans classes ou permission', () => {
    service.load('school', 'year', ['a']); const previous = http.match(() => true);
    service.load('school', 'other-year', []); expect(previous.every(request => request.cancelled)).toBeTrue(); expect(service.indicators()).toEqual({});
    spyOn(TestBed.inject(WorkspaceAccessService), 'hasPermission').and.returnValue(false);
    service.load('school', 'year', ['a']); http.expectNone(() => true); expect(service.indicators()).toEqual({});
  });

  it('limite à quatre les consultations de salles simultanées', () => {
    service.load('school', 'year', ['a', 'b', 'c', 'd', 'e']); http.expectOne(`${base}/enrollments`).flush([]);
    const requests = http.match(request => request.url.endsWith('/classrooms')); expect(requests.length).toBe(4);
    requests[0].flush([]); http.expectOne(roomsUrl('e')).flush([]); requests.slice(1).forEach(request => request.flush([]));
    expect(service.loading()).toBeFalse();
  });
});
