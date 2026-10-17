import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  const base = `${environment.apiUrl}/establishments/school-1/school-years/year-1`;
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('charge la feuille depuis le endpoint dédié et transmet la date', () => {
    TestBed.inject(AttendanceService).getSheet('school-1', 'year-1', 'class-1', '2026-10-16').subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(`${base}/classes/class-1/attendance?date=2026-10-16`);
    expect(request.request.method).toBe('GET');
    request.flush({ entries: [] });
  });

  it('filtre la feuille par salle quand un classroomId est sélectionné', () => {
    TestBed.inject(AttendanceService).getSheet('school-1', 'year-1', 'class-1', '2026-10-16', 'room-1').subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(`${base}/classes/class-1/attendance?date=2026-10-16&classroomId=room-1`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('classroomId')).toBe('room-1');
    request.flush({ entries: [] });
  });

  it('envoie un lot PUT versionné sans ajouter les élèves omis', () => {
    const entries = [{ studentId: 'student-1', status: 'ABSENT' as const, absenceJustified: true, comment: 'Maladie', expectedUpdatedAt: '2026-10-16T08:00:00Z' }];
    TestBed.inject(AttendanceService).save('school-1', 'year-1', 'class-1', '2026-10-16', 'room-1', entries).subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(`${base}/classes/class-1/attendance/2026-10-16`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ classroomId: 'room-1', entries });
    request.flush({ entries: [] });
  });

  it('charge l’historique sans pagination inventée', () => {
    TestBed.inject(AttendanceService).getHistory('school-1', 'year-1', 'student-1', '2026-10-01', '2026-10-16').subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne(`${base}/students/student-1/attendance?from=2026-10-01&to=2026-10-16`);
    expect(request.request.method).toBe('GET');
    request.flush({ records: [] });
  });
});