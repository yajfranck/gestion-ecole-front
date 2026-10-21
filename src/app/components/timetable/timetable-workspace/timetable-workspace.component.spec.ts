import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { withPermissionChecks } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LicenseAccessService } from '../../../core/license-access.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PendingChangesService } from '../../../shared/pending-changes.service';
import { shiftCalendarDate } from '../../../shared/timetable';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { TimetableEntryFormComponent } from '../timetable-entry-form/timetable-entry-form.component';
import { TimetableCopyFormComponent } from '../timetable-copy-form/timetable-copy-form.component';
import { TimetableDaysFormComponent } from '../timetable-days-form/timetable-days-form.component';
import {
  timetableClass,
  timetableEntry,
  timetableRoom,
  timetableSubject,
  timetableYear,
} from '../testing/timetable.fixtures';
import { TimetableWorkspaceComponent } from './timetable-workspace.component';

describe('TimetableWorkspaceComponent', () => {
  const school = `${environment.apiUrl}/establishments/school`;
  const classesUrl = `${school}/school-years/year/classes`;
  const classUrl = `${classesUrl}/class`;
  const base = `${classUrl}/classrooms/room/timetable`;
  const permissions = signal([
    'can_school_class_read',
    'can_subject_read',
    'can_class_subject_read',
    'can_timetable_read',
    'can_timetable_create',
    'can_timetable_update',
    'can_timetable_delete',
    'can_timetable_copy',
  ]);
  const year = signal({ ...timetableYear });
  const params = new BehaviorSubject(
    convertToParamMap({ establishmentId: 'school', academicYearId: 'year' }),
  );
  const route = { paramMap: params, snapshot: { queryParamMap: convertToParamMap({}) } };
  beforeEach(() => {
    permissions.set([
      'can_school_class_read',
      'can_subject_read',
      'can_class_subject_read',
      'can_timetable_read',
      'can_timetable_create',
      'can_timetable_update',
      'can_timetable_delete',
      'can_timetable_copy',
    ]);
    year.set({ ...timetableYear });
    route.snapshot.queryParamMap = convertToParamMap({});
    params.next(convertToParamMap({ establishmentId: 'school', academicYearId: 'year' }));
    TestBed.configureTestingModule({
      imports: [TimetableWorkspaceComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: WorkspaceContextService, useValue: { academicYear: year } },
        { provide: WorkspaceAccessService, useValue: withPermissionChecks({ authorities: permissions }) },
        {
          provide: LicenseAccessService,
          useValue: {
            canUse: (permission: string, feature: string, id: string) =>
              id === 'school' &&
              feature === 'SCHOOL_MANAGEMENT' &&
              permissions().includes(permission),
          },
        },
      ],
    });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function create() {
    const fixture = TestBed.createComponent(TimetableWorkspaceComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      root: fixture.nativeElement as HTMLElement,
      http: TestBed.inject(HttpTestingController),
    };
  }
  function flushPlanning(http: HttpTestingController, url = base) {
    http.expectOne(url).flush([timetableEntry]);
    const request = http.expectOne((request) => request.url === `${url}/week`);
    const date = request.request.params.get('date')!;
    const monday = shiftCalendarDate(date, -(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7);
    request.flush({
      startsOn: monday,
      endsOn: shiftCalendarDate(monday, 6),
      days: Array.from({ length: 7 }, (_, i) => ({
        date: shiftCalendarDate(monday, i),
        withinAcademicYear: true,
        nonWorkingDay: null,
        entries: i === 0 ? [timetableEntry] : [],
      })),
    });
  }
  function start() {
    const result = create();
    const { http, fixture } = result;
    http
      .expectOne(classesUrl)
      .flush([timetableClass, { ...timetableClass, id: 'foreign', establishmentId: 'other' }]);
    http.expectOne(`${school}/subjects`).flush([timetableSubject]);
    http.expectOne(`${classUrl}/subjects`).flush([
      {
        id: 'assignment',
        establishmentId: 'school',
        schoolClassId: 'class',
        subjectId: 'math',
        enabled: true,
      },
    ]);
    http
      .expectOne(`${classUrl}/classrooms`)
      .flush([
        timetableRoom,
        { ...timetableRoom, id: 'room-b', name: 'Sixième B' },
        { ...timetableRoom, id: 'foreign-room', academicYearId: 'other' },
      ]);
    flushPlanning(
      http,
      route.snapshot.queryParamMap.get('classroomId') === 'room-b'
        ? `${classUrl}/classrooms/room-b/timetable`
        : base,
    );
    fixture.detectChanges();
    return result;
  }
  it('charge uniquement les classes et salles actives du périmètre et affiche la semaine', () => {
    route.snapshot.queryParamMap = convertToParamMap({
      classId: 'foreign',
      classroomId: 'foreign-room',
    });
    const { component, root } = start();
    expect(component['classes']()).toEqual([timetableClass]);
    expect(component['rooms']().map((room) => room.id)).toEqual(['room', 'room-b']);
    expect(component['scope']()?.classroomId).toBe('room');
    expect(root.textContent).toContain('Mathématiques');
    expect(root.textContent).toContain('Créer un créneau');
  });
  it('ne fait aucune requête sans accès de lecture', () => {
    permissions.set([]);
    const { http, root } = create();
    http.expectNone(() => true);
    expect(root.textContent).toContain('compte du personnel autorisé');
  });
  it('reste en lecture seule sans permissions de mutation', () => {
    permissions.set(['can_school_class_read', 'can_subject_read', 'can_class_subject_read', 'can_timetable_read']);
    const { root } = start();
    expect(root.textContent).not.toContain('Créer un créneau');
    expect(root.textContent).not.toContain('Copier vers une salle');
    expect(root.querySelector('app-table-actions')).toBeNull();
  });
  it('utilise la vue datée pour masquer un jour non ouvré sans perdre le modèle source', () => {
    const { fixture, component, root, http } = start();
    component['setView']('day');
    http.expectOne(base).flush([timetableEntry]);
    http
      .expectOne((request) => request.url === `${base}/day`)
      .flush({
        date: component['date'](),
        withinAcademicYear: true,
        nonWorkingDay: 'Jour férié',
        entries: [],
      });
    fixture.detectChanges();
    expect(root.textContent).toContain('Jour férié');
    expect(root.querySelectorAll('article').length).toBe(0);
    expect(component['entries']().length).toBe(1);
  });
  it('annule une ancienne lecture lors d’un changement rapide de salle et ignore son périmètre', () => {
    const { fixture, component, root, http } = start();
    const select = root.querySelectorAll<HTMLSelectElement>(
      'section[aria-label="Sélection du planning"] select',
    )[1];
    component['changeRoom']('room-b', select);
    const previous = http.expectOne(`${classUrl}/classrooms/room-b/timetable`);
    const previousWeek = http.expectOne(
      (request) => request.url === `${classUrl}/classrooms/room-b/timetable/week`,
    );
    component['changeRoom']('room', select);
    expect(previous.cancelled).toBeTrue();
    expect(previousWeek.cancelled).toBeTrue();
    flushPlanning(http);
    fixture.detectChanges();
    expect(component['entries']()).toEqual([timetableEntry]);
    expect(component['scope']()?.classroomId).toBe('room');
  });
  it('conserve le formulaire et le contexte si l’abandon de saisie est refusé', () => {
    const { fixture, component, root, http } = start();
    component['openEditor']('entry');
    fixture.detectChanges();
    TestBed.inject(PendingChangesService).dirty.set(true);
    spyOn(TestBed.inject(ConfirmationDialogService), 'confirm').and.stub();
    component['closeEditor']();
    expect(component['editor']()).toBe('entry');
    const select = root.querySelectorAll<HTMLSelectElement>(
      'section[aria-label="Sélection du planning"] select',
    )[1];
    component['changeRoom']('room-b', select);
    expect(component['classroomId']()).toBe('room');
    expect(select.value).toBe('room');
    http.expectNone(`${classUrl}/classrooms/room-b/timetable`);
  });
  it('ferme le formulaire après création et recharge le planning de la même salle', () => {
    const { fixture, component, root, http } = start();
    component['openEditor']('entry');
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(TimetableEntryFormComponent))
      .componentInstance as TimetableEntryFormComponent;
    form['subjectId'] = 'math';
    form['startTime'] = '10:00';
    form['endTime'] = '11:00';
    form['save']();
    const request = http.expectOne(base);
    expect(request.request.method).toBe('POST');
    request.flush({ ...timetableEntry, id: 'new' });
    flushPlanning(http);
    fixture.detectChanges();
    expect(component['editor']()).toBeNull();
    expect(root.querySelector('app-dialog')).toBeNull();
    expect(root.textContent).toContain('Le créneau a été enregistré.');
    expect(TestBed.inject(PendingChangesService).saving()).toBeFalse();
  });
  it('archive le créneau récurrent puis recharge les occurrences', () => {
    const { component, http } = start();
    spyOn(TestBed.inject(ConfirmationDialogService), 'confirm').and.callFake((_message, accept) => accept());
    component['archive'](timetableEntry);
    const request = http.expectOne(`${base}/entry`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    flushPlanning(http);
    expect(component['success']()).toContain('archivé');
  });
  it('efface les messages de la salle précédente lors du changement de salle', () => {
    const { component, root, http } = start();
    component['success'].set('Planning copié vers une autre salle.');
    component['copiedTarget'].set({ ...timetableRoom, id: 'room-b' });
    component['actionError'].set('Ancienne erreur');
    const select = root.querySelectorAll<HTMLSelectElement>(
      'section[aria-label="Sélection du planning"] select',
    )[1];
    component['changeRoom']('room-b', select);
    flushPlanning(http, `${classUrl}/classrooms/room-b/timetable`);
    expect(component['success']()).toBeNull();
    expect(component['copiedTarget']()).toBeNull();
    expect(component['actionError']()).toBeNull();
  });
  it('annule le suivi d’un archivage lors d’un changement d’année', () => {
    const { component, fixture, http } = start();
    spyOn(TestBed.inject(ConfirmationDialogService), 'confirm').and.callFake((_message, accept) => accept());
    component['archive'](timetableEntry);
    const archive = http.expectOne(`${base}/entry`);
    expect(TestBed.inject(PendingChangesService).saving()).toBeTrue();
    year.set({ ...timetableYear, id: 'another-year' });
    fixture.detectChanges();
    expect(archive.cancelled).toBeTrue();
    expect(TestBed.inject(PendingChangesService).saving()).toBeFalse();
    expect(component['success']()).toBeNull();
    expect(component['entries']()).toEqual([]);
  });
  it('bloque les actions si l’accès de lecture disparaît avant le rafraîchissement de la vue', () => {
    const { component, http } = start();
    const confirm = spyOn(window, 'confirm');
    permissions.set(['can_timetable_update', 'can_timetable_delete']);
    component['archive'](timetableEntry);
    component['editEntry'](timetableEntry);
    http.expectNone(`${base}/entry`);
    expect(confirm).not.toHaveBeenCalled();
    expect(component['editor']()).toBeNull();
  });
  it('ferme le formulaire de copie après succès et permet d’ouvrir la destination', () => {
    const { component, fixture, root, http } = start();
    component['openEditor']('copy');
    fixture.detectChanges();
    const target = { ...timetableRoom, id: 'room-b', name: 'Sixième B' };
    http.expectOne(`${classUrl}/classrooms`).flush([timetableRoom, target]);
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(TimetableCopyFormComponent))
      .componentInstance as TimetableCopyFormComponent;
    form['targetClassroomId'] = target.id;
    form['save']();
    http.expectOne(`${base}/copy`).flush([
      {
        ...timetableEntry,
        id: 'copied',
        classroomId: target.id,
        copiedFromId: timetableEntry.id,
      },
    ]);
    flushPlanning(http);
    fixture.detectChanges();
    expect(root.querySelector('app-dialog')).toBeNull();
    expect(component['copiedTarget']()).toEqual(target);
    component['showCopied']();
    http.expectOne(`${school}/subjects`).flush([timetableSubject]);
    http.expectOne(`${classUrl}/subjects`).flush([]);
    http.expectOne(`${classUrl}/classrooms`).flush([timetableRoom, target]);
    flushPlanning(http, `${classUrl}/classrooms/room-b/timetable`);
    expect(component['classroomId']()).toBe(target.id);
    expect(component['success']()).toBeNull();
    expect(component['copiedTarget']()).toBeNull();
  });
  it('ferme le calendrier après succès et recharge les vues datées', () => {
    const { component, fixture, root, http } = start();
    component['openEditor']('days');
    fixture.detectChanges();
    const url = `${school}/school-years/year/timetable/non-working-days`;
    http.expectOne(url).flush([]);
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(TimetableDaysFormComponent))
      .componentInstance as TimetableDaysFormComponent;
    form['days'] = [{ date: '2026-12-25', name: 'Noël' }];
    form['save']();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('PUT');
    request.flush([{ date: '2026-12-25', name: 'Noël' }]);
    flushPlanning(http);
    fixture.detectChanges();
    expect(root.querySelector('app-dialog')).toBeNull();
    expect(component['success']()).toContain('enregistrés pour toute l’année');
    expect(TestBed.inject(PendingChangesService).saving()).toBeFalse();
  });
  it('refuse une date hors année sans envoyer de requête', () => {
    const { component, http } = start();
    const previous = component['date']();
    component['changeDate']('2027-09-01');
    expect(component['date']()).toBe(previous);
    http.expectNone((request) => request.url.startsWith(base));
    expect(component['actionError']()).toContain('année scolaire');
  });
  it('navigue du lundi au dimanche en conservant la classe et la salle sélectionnées', () => {
    route.snapshot.queryParamMap = convertToParamMap({ classId: 'class', classroomId: 'room-b' });
    const url = `${classUrl}/classrooms/room-b/timetable`;
    const { component, fixture, root, http } = start();
    component['changeDate']('2026-10-21');
    flushPlanning(http, url);
    fixture.detectChanges();
    expect(root.textContent).toContain('19 – 25 octobre 2026');
    root.querySelector<HTMLButtonElement>('[aria-label="Semaine suivante"]')!.click();
    expect(component['date']()).toBe('2026-10-26');
    expect(component['loadingPlanning']()).toBeTrue();
    fixture.detectChanges();
    expect(root.textContent).toContain('Chargement du planning');
    flushPlanning(http, url);
    fixture.detectChanges();
    expect(component['columns']()[0].date).toBe('2026-10-26');
    expect(component['columns']()[6].date).toBe('2026-11-01');
    expect(root.textContent).toContain('26 octobre – 1 novembre 2026');
    component['shiftDate'](-1);
    flushPlanning(http, url);
    expect(component['periodStart']()).toBe('2026-10-19');
    expect(component['classId']()).toBe('class');
    expect(component['classroomId']()).toBe('room-b');
  });
  it('bloque les semaines hors année, sans répéter la première ou la dernière semaine', () => {
    const { component, fixture, root, http } = start();
    component['changeDate']('2026-09-03');
    flushPlanning(http);
    fixture.detectChanges();
    expect(component['periodStart']()).toBe('2026-08-31');
    expect(
      root.querySelector<HTMLButtonElement>('[aria-label="Semaine précédente"]')!.disabled,
    ).toBeTrue();
    component['shiftDate'](-1);
    http.expectNone((request) => request.url.startsWith(base));
    component['changeDate']('2027-06-22');
    flushPlanning(http);
    component['shiftDate'](1);
    flushPlanning(http);
    fixture.detectChanges();
    expect(component['date']()).toBe('2027-06-28');
    expect(component['periodEnd']()).toBe('2027-07-04');
    expect(
      root.querySelector<HTMLButtonElement>('[aria-label="Semaine suivante"]')!.disabled,
    ).toBeTrue();
    component['shiftDate'](1);
    http.expectNone((request) => request.url.startsWith(base));
  });
  it('permet de choisir une semaine par date et restaure une date invalide', () => {
    const { component, fixture, root, http } = start();
    const input = root.querySelector<HTMLInputElement>('input[type="date"]')!;
    input.value = '2026-12-30';
    input.dispatchEvent(new Event('change'));
    flushPlanning(http);
    fixture.detectChanges();
    expect(component['periodLabel']()).toBe('28 décembre 2026 – 3 janvier 2027');
    input.value = '2027-07-01';
    input.dispatchEvent(new Event('change'));
    expect(input.value).toBe('2026-12-30');
    http.expectNone((request) => request.url.startsWith(base));
  });
  it('revient à aujourd’hui dans l’année scolaire et conserve le filtre de salle', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 21, 0, 30));
    try {
      const { component, http } = start();
      component['changeDate']('2026-11-06');
      flushPlanning(http);
      component['goToday']();
      const request = http.expectOne((request) => request.url === `${base}/week`);
      expect(request.request.params.get('date')).toBe('2026-10-21');
      request.flush({ days: [] });
      http.expectOne(base).flush([]);
      expect(component['periodLabel']()).toBe('19 – 25 octobre 2026');
      expect(component['classroomId']()).toBe('room');
    } finally {
      jasmine.clock().uninstall();
    }
  });
  it('désactive Aujourd’hui si la date du jour est hors de l’année sélectionnée', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2028, 0, 1));
    try {
      const { component, root, http } = start();
      const button = Array.from(root.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Aujourd’hui'),
      )!;
      expect(button.disabled).toBeTrue();
      expect(button.title).toContain('hors de l’année scolaire');
      component['goToday']();
      http.expectNone((request) => request.url.startsWith(base));
    } finally {
      jasmine.clock().uninstall();
    }
  });
  it('conserve la date au changement de vue et navigue par jour en vue journée', () => {
    const { component, http } = start();
    component['changeDate']('2027-03-27');
    flushPlanning(http);
    const flushDay = (date: string) => {
      http.expectOne(base).flush([timetableEntry]);
      const request = http.expectOne((request) => request.url === `${base}/day`);
      expect(request.request.params.get('date')).toBe(date);
      request.flush({ date, withinAcademicYear: true, nonWorkingDay: null, entries: [] });
    };
    component['setView']('day');
    flushDay('2027-03-27');
    component['shiftDate'](1);
    flushDay('2027-03-28');
    component['shiftDate'](1);
    flushDay('2027-03-29');
    expect(component['periodLabel']()).toBe('lundi 29 mars 2027');
    component['setView']('week');
    flushPlanning(http);
    expect(component['periodLabel']()).toBe('29 mars – 4 avril 2027');
  });
  it('annule une navigation dépassée et permet de réessayer après une erreur', () => {
    const { component, fixture, root, http } = start();
    component['changeDate']('2026-10-21');
    const previousList = http.expectOne(base);
    const previousWeek = http.expectOne((request) => request.url === `${base}/week`);
    component['shiftDate'](1);
    expect(previousList.cancelled).toBeTrue();
    expect(previousWeek.cancelled).toBeTrue();
    http.expectOne(base).flush([]);
    http
      .expectOne((request) => request.url === `${base}/week`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(component['loadingPlanning']()).toBeFalse();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('app-timetable-board')).toBeNull();
    component['loadPlanning']();
    flushPlanning(http);
    fixture.detectChanges();
    expect(root.querySelector('app-timetable-board')).not.toBeNull();
    expect(component['periodStart']()).toBe('2026-10-26');
  });
});
