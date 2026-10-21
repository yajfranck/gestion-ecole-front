import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TimetableBoardComponent } from './timetable-board.component';
import { timetableEmployee, timetableEntry, timetableSubject } from '../testing/timetable.fixtures';

describe('TimetableBoardComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [TimetableBoardComponent],
      providers: [provideZonelessChangeDetection()],
    }),
  );
  it('affiche les horaires et les ressources sans commandes de mutation en lecture seule', () => {
    const fixture = TestBed.createComponent(TimetableBoardComponent);
    fixture.componentRef.setInput('columns', [
      {
        key: 'monday',
        label: 'Lundi',
        date: '2026-10-26',
        withinAcademicYear: true,
        nonWorkingDay: null,
        entries: [timetableEntry],
      },
    ]);
    fixture.componentRef.setInput('subjects', [timetableSubject]);
    fixture.componentRef.setInput('employees', [timetableEmployee]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('08:00 – 09:00');
    expect(root.textContent).toContain('Mathématiques');
    expect(root.textContent).toContain('Ada Exemple');
    expect(root.textContent).toContain('26 oct.');
    expect(root.querySelector('app-table-actions')).toBeNull();
  });
  it('distingue les jours fermés et ceux situés hors année sans afficher de cours', () => {
    const fixture = TestBed.createComponent(TimetableBoardComponent);
    fixture.componentRef.setInput('columns', [
      {
        key: 'closed',
        label: 'Vendredi',
        date: '2026-12-25',
        withinAcademicYear: true,
        nonWorkingDay: 'Férié',
        entries: [],
      },
      {
        key: 'outside',
        label: 'Lundi',
        date: '2026-08-31',
        withinAcademicYear: false,
        nonWorkingDay: null,
        entries: [],
      },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Férié');
    expect(fixture.nativeElement.textContent).toContain('Hors année scolaire');
    expect(fixture.nativeElement.querySelectorAll('article').length).toBe(0);
  });
  it('aligne les cours sur les horaires réels et conserve les minutes et les intervalles libres', () => {
    const fixture = TestBed.createComponent(TimetableBoardComponent);
    const first = { ...timetableEntry, startTime: '08:15:00', endTime: '09:30:00' };
    const second = { ...timetableEntry, id: 'second', startTime: '10:00:00', endTime: '11:00:00' };
    fixture.componentRef.setInput('columns', [
      {
        key: 'monday',
        label: 'Lundi',
        withinAcademicYear: true,
        nonWorkingDay: null,
        entries: [second, first],
      },
    ]);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component['slots']().map((slot) => slot.start)).toEqual([
      '08:15',
      '09:00',
      '09:30',
      '10:00',
    ]);
    const day = component['layout']()[0];
    expect(day.courses.map((course) => course.entry.id)).toEqual([first.id, second.id]);
    expect(day.courses.map((course) => course.row)).toEqual(['2 / 4', '5 / 6']);
    expect(day.gaps).toEqual([{ start: '09:30', end: '10:00', row: '4 / 5' }]);
    expect(day.blocks.map((block) => block.kind)).toEqual(['course', 'gap', 'course']);
    expect(fixture.nativeElement.textContent).toContain('Créneau libre');
    expect(fixture.nativeElement.textContent).not.toContain('Pause');
  });
  it('affiche tous les créneaux simultanés du modèle dans des sous-colonnes distinctes', () => {
    const fixture = TestBed.createComponent(TimetableBoardComponent);
    const overlapping = {
      ...timetableEntry,
      id: 'other-period',
      startTime: '08:30:00',
      endTime: '09:30:00',
      validFrom: '2027-01-01',
    };
    const next = { ...timetableEntry, id: 'next', startTime: '09:30:00', endTime: '10:00:00' };
    fixture.componentRef.setInput('columns', [
      {
        key: 'monday',
        label: 'Lundi',
        withinAcademicYear: true,
        nonWorkingDay: null,
        entries: [timetableEntry, overlapping, next],
      },
    ]);
    fixture.componentRef.setInput('showPeriod', true);
    fixture.detectChanges();
    const day = fixture.componentInstance['layout']()[0];
    expect(day.lanes).toBe(2);
    expect(day.courses.map((course) => course.lane)).toEqual([1, 2, 1]);
    expect(fixture.nativeElement.querySelectorAll('article').length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('01/01/2027');
  });
  it('attribue une couleur stable par matière et affiche une seule entrée de légende par matière', () => {
    const fixture = TestBed.createComponent(TimetableBoardComponent);
    const component = fixture.componentInstance;
    const color = component['palette'](timetableSubject.id);
    fixture.componentRef.setInput('columns', [
      {
        key: 'monday',
        label: 'Lundi',
        withinAcademicYear: true,
        nonWorkingDay: null,
        entries: [timetableEntry, { ...timetableEntry, id: 'second' }],
      },
    ]);
    fixture.componentRef.setInput('subjects', [timetableSubject]);
    fixture.detectChanges();
    expect(component['legend']()).toEqual([timetableSubject.id]);
    expect(
      fixture.nativeElement.querySelectorAll('[aria-label="Légende des matières"] li').length,
    ).toBe(1);
    fixture.componentRef.setInput('subjects', []);
    fixture.detectChanges();
    expect(component['palette'](timetableSubject.id)).toBe(color);
  });
  it('préserve les actions de modification et archivage et leur état désactivé', () => {
    const fixture = TestBed.createComponent(TimetableBoardComponent);
    fixture.componentRef.setInput('columns', [
      {
        key: 'monday',
        label: 'Lundi',
        withinAcademicYear: true,
        nonWorkingDay: null,
        entries: [timetableEntry],
      },
    ]);
    fixture.componentRef.setInput('canEdit', true);
    fixture.componentRef.setInput('canArchive', true);
    const edit = jasmine.createSpy('edit');
    const archive = jasmine.createSpy('archive');
    fixture.componentInstance.edit.subscribe(edit);
    fixture.componentInstance.archive.subscribe(archive);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll(
      '.table-action',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[0].click();
    buttons[1].click();
    expect(edit).toHaveBeenCalledOnceWith(timetableEntry);
    expect(archive).toHaveBeenCalledOnceWith(timetableEntry);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(Array.from(buttons).every((button) => button.disabled)).toBeTrue();
  });
  it('garde un planning vide sans inventer de plage horaire ni de cours', () => {
    const fixture = TestBed.createComponent(TimetableBoardComponent);
    fixture.componentRef.setInput('columns', [
      { key: 'monday', label: 'Lundi', withinAcademicYear: true, nonWorkingDay: null, entries: [] },
    ]);
    fixture.detectChanges();
    expect(fixture.componentInstance['slots']()).toEqual([]);
    expect(fixture.nativeElement.querySelectorAll('article').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Aucun cours');
  });
});
