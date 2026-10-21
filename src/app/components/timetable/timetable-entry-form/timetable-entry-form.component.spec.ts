import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { TimetableEntryFormComponent } from './timetable-entry-form.component';
import {
  timetableEmployee,
  timetableEntry,
  timetableScope,
  timetableSubject,
  timetableYear,
} from '../testing/timetable.fixtures';

describe('TimetableEntryFormComponent', () => {
  const url = `${environment.apiUrl}/establishments/school/school-years/year/classes/class/classrooms/room/timetable`;
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [TimetableEntryFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function create(editing = false) {
    const fixture = TestBed.createComponent(TimetableEntryFormComponent);
    for (const [key, value] of Object.entries({
      scope: timetableScope,
      year: timetableYear,
      subjects: [timetableSubject],
      employees: [timetableEmployee],
      allowed: true,
      canChooseTeacher: true,
      entry: editing ? timetableEntry : null,
    }))
      fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    if (!editing) {
      component['subjectId'] = 'math';
      component['startTime'] = '08:00';
      component['endTime'] = '09:00';
    }
    return { fixture, component, http: TestBed.inject(HttpTestingController) };
  }
  it('crée un cours en heures locales avec personnel facultatif et local normalisé', () => {
    const { component, http } = create();
    component['roomCode'] = ' lab-b ';
    component['teacherId'] = 'teacher';
    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);
    component['save']();
    const request = http.expectOne(url);
    expect(request.request.body).toEqual({
      subjectId: 'math',
      teacherId: 'teacher',
      dayOfWeek: 'MONDAY',
      startTime: '08:00',
      endTime: '09:00',
      validFrom: '2026-09-01',
      validUntil: '2027-06-30',
      roomCode: 'LAB-B',
    });
    request.flush(timetableEntry);
    expect(saved).toHaveBeenCalledWith(timetableEntry);
  });
  it('remplace le créneau complet et retire explicitement le personnel et le local laissés vides', () => {
    const { component, http } = create(true);
    component['teacherId'] = '';
    component['roomCode'] = '';
    component['save']();
    const request = http.expectOne(`${url}/entry`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.teacherId).toBeNull();
    expect(request.request.body.roomCode).toBeNull();
    expect(request.request.body.startTime).toBe('08:00');
    expect(request.request.body.validUntil).toBe('2027-06-30');
    request.flush(timetableEntry);
  });
  for (const [start, end] of [
    ['24:00', '09:00'],
    ['09:00', '08:00'],
    ['23:00', '01:00'],
    ['08:00:15', '09:00'],
  ]) {
    it(`refuse les heures invalides ou passant minuit : ${start}–${end}`, () => {
      const { component, http } = create();
      component['startTime'] = start;
      component['endTime'] = end;
      component['save']();
      http.expectNone(url);
      expect(component['error']()).toContain('heures valides');
    });
  }
  it('refuse une période sans occurrence du jour choisi et les références étrangères', () => {
    const { component, http } = create();
    component['validFrom'] = '2026-09-08';
    component['validUntil'] = '2026-09-08';
    component['save']();
    http.expectNone(url);
    component['validUntil'] = '2026-09-30';
    component['subjectId'] = 'foreign';
    component['save']();
    http.expectNone(url);
    expect(component['error']()).toContain('matière active');
    component['subjectId'] = 'math';
    component['teacherId'] = 'foreign';
    component['save']();
    http.expectNone(url);
    expect(component['error']()).toContain('personnel actif');
  });
  it('conserve le créneau existant si le personnel n’est pas consultable', () => {
    const { fixture, component, http } = create(true);
    fixture.componentRef.setInput('employees', []);
    fixture.componentRef.setInput('canChooseTeacher', false);
    fixture.detectChanges();
    component['save']();
    const request = http.expectOne(`${url}/entry`);
    expect(request.request.body.teacherId).toBe('teacher');
    request.flush(timetableEntry);
  });
  it('préserve le brouillon après conflit et bloque les doubles envois', () => {
    const { component, http } = create();
    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);
    component['save']();
    component['save']();
    http
      .expectOne(url)
      .flush({ conflictingEntryId: 'other' }, { status: 409, statusText: 'Conflict' });
    expect(component['startTime']).toBe('08:00');
    expect(component['error']()).toContain('conflit');
    expect(component['saving']()).toBeFalse();
    expect(saved).not.toHaveBeenCalled();
  });
  it('bloque la mutation sans droit et la modification d’un créneau d’une autre salle', () => {
    const { fixture, component, http } = create();
    fixture.componentRef.setInput('allowed', false);
    fixture.detectChanges();
    component['save']();
    http.expectNone(url);
    fixture.componentRef.setInput('allowed', true);
    fixture.componentRef.setInput('entry', { ...timetableEntry, classroomId: 'other' });
    fixture.detectChanges();
    component['save']();
    http.expectNone(`${url}/entry`);
    expect(component['error']()).toContain('salle sélectionnée');
  });
});
