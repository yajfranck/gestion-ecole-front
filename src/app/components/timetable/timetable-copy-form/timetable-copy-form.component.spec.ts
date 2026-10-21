import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { TimetableCopyFormComponent } from './timetable-copy-form.component';
import {
  timetableClass,
  timetableEmployee,
  timetableEntry,
  timetableRoom,
  timetableScope,
  timetableYear,
} from '../testing/timetable.fixtures';

describe('TimetableCopyFormComponent', () => {
  const base = `${environment.apiUrl}/establishments/school/school-years/year/classes/class/classrooms`;
  const target = { ...timetableRoom, id: 'target', name: 'Sixième B', code: 'B' };
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [TimetableCopyFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function create() {
    const fixture = TestBed.createComponent(TimetableCopyFormComponent);
    for (const [key, value] of Object.entries({
      scope: timetableScope,
      year: timetableYear,
      classes: [timetableClass, { ...timetableClass, id: 'other-class' }],
      entries: [timetableEntry],
      employees: [timetableEmployee, { ...timetableEmployee, id: 'new-teacher' }],
      allowed: true,
      canChooseTeacher: true,
    }))
      fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne(base)
      .flush([timetableRoom, target, { ...target, id: 'foreign', academicYearId: 'other' }]);
    fixture.detectChanges();
    fixture.componentInstance['targetClassroomId'] = 'target';
    return { fixture, component: fixture.componentInstance, http };
  }
  it('écarte la source et les salles étrangères, puis copie sans remplacer ni conserver les ressources par défaut', () => {
    const { component, http } = create();
    expect(component['rooms']()).toEqual([target]);
    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);
    component['save']();
    const request = http.expectOne(`${base}/room/timetable/copy`);
    expect(request.request.body).toEqual({
      targetClassroomId: 'target',
      replaceExisting: false,
      copyTeachers: false,
      copyRoomCodes: false,
    });
    request.flush([
      { ...timetableEntry, id: 'copy', classroomId: 'target', copiedFromId: 'entry' },
    ]);
    expect(saved).toHaveBeenCalledWith(jasmine.objectContaining({ target }));
  });
  it('exige le droit de suppression pour remplacer le planning cible', () => {
    const { component, http } = create();
    component['replaceExisting'] = true;
    component['save']();
    http.expectNone(`${base}/room/timetable/copy`);
    expect(component['error']()).toContain('droit d’archiver');
  });
  it('transmet les options explicites, les dates et les correspondances d’enseignants', () => {
    const { fixture, component, http } = create();
    fixture.componentRef.setInput('canReplace', true);
    fixture.detectChanges();
    component['replaceExisting'] = true;
    component['copyTeachers'] = true;
    component['teacherMappings'] = { teacher: 'new-teacher' };
    component['validFrom'] = '2026-10-01';
    component['save']();
    const request = http.expectOne(`${base}/room/timetable/copy`);
    expect(request.request.body.teacherMappings).toEqual({ teacher: 'new-teacher' });
    expect(request.request.body.validFrom).toBe('2026-10-01');
    expect(request.request.body.replaceExisting).toBeTrue();
    request.flush([]);
  });
  it('ne réutilise pas la liste de salles précédente pendant un changement de classe', () => {
    const { component, http } = create();
    component['targetClassId'] = 'other-class';
    component['loadRooms']();
    expect(component['targetClassroomId']).toBe('');
    component['targetClassroomId'] = 'target';
    component['save']();
    http.expectNone(`${base}/room/timetable/copy`);
    http
      .expectOne(
        `${environment.apiUrl}/establishments/school/school-years/year/classes/other-class/classrooms`,
      )
      .flush([]);
  });
  it('conserve la destination et les options après un conflit sans annoncer de copie', () => {
    const { component, http } = create();
    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);
    component['save']();
    http
      .expectOne(`${base}/room/timetable/copy`)
      .flush({}, { status: 409, statusText: 'Conflict' });
    expect(component['targetClassroomId']).toBe('target');
    expect(component['error']()).toContain('conflit');
    expect(saved).not.toHaveBeenCalled();
  });
});
