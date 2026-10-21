import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { TimetableService } from './timetable.service';
import { TimetableEntryRequest, TimetableScope } from '../../models/timetable/timetable.model';

describe('TimetableService', () => {
  const scope: TimetableScope = {
    establishmentId: 'school',
    academicYearId: 'year',
    schoolClassId: 'class',
    classroomId: 'room',
  };
  const base = `${environment.apiUrl}/establishments/school/school-years/year/classes/class/classrooms/room/timetable`;
  let api: TimetableService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(TimetableService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('consulte le modèle, une fiche, le jour et la semaine dans le périmètre de la salle', () => {
    api.list(scope, 'MONDAY').subscribe();
    const list = http.expectOne(`${base}?dayOfWeek=MONDAY`);
    expect(list.request.method).toBe('GET');
    list.flush([]);
    api.get(scope, 'entry').subscribe();
    http.expectOne(`${base}/entry`).flush({ id: 'entry' });
    api.day(scope, '2026-09-07').subscribe();
    http.expectOne(`${base}/day?date=2026-09-07`).flush({ entries: [] });
    api.week(scope, '2026-09-07').subscribe();
    http.expectOne(`${base}/week?date=2026-09-07`).flush({ days: [] });
  });
  it('crée puis remplace complètement un créneau avec PUT et peut l’archiver', () => {
    const body: TimetableEntryRequest = {
      subjectId: 'math',
      teacherId: null,
      dayOfWeek: 'MONDAY',
      startTime: '08:00',
      endTime: '09:00',
      validFrom: '2026-09-07',
      validUntil: '2026-09-07',
      roomCode: null,
    };
    api.create(scope, body).subscribe();
    const create = http.expectOne(base);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(body);
    create.flush({});
    api.update(scope, 'entry', body).subscribe();
    const update = http.expectOne(`${base}/entry`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(body);
    update.flush({});
    api.archive(scope, 'entry').subscribe();
    const archive = http.expectOne(`${base}/entry`);
    expect(archive.request.method).toBe('DELETE');
    archive.flush(null);
  });
  it('transmet les options de copie et les mappings sans changer la salle source', () => {
    const body = {
      targetClassroomId: 'destination',
      replaceExisting: true,
      copyTeachers: false,
      copyRoomCodes: false,
      teacherMappings: { teacher: 'other' },
      validFrom: '2026-10-01',
    };
    api.copy(scope, body).subscribe();
    const copy = http.expectOne(`${base}/copy`);
    expect(copy.request.method).toBe('POST');
    expect(copy.request.body).toEqual(body);
    copy.flush([]);
  });
  it('lit et remplace les jours non ouvrés au niveau de l’année, y compris par une liste vide', () => {
    const url = `${environment.apiUrl}/establishments/school/school-years/year/timetable/non-working-days`;
    api.nonWorkingDays('school', 'year').subscribe();
    http.expectOne(url).flush([]);
    api.replaceNonWorkingDays('school', 'year', []).subscribe();
    const update = http.expectOne(url);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ days: [] });
    update.flush([]);
  });
});
