import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { Employee } from '../../../models/employee/employee.model';
import { Subject } from '../../../models/subject/subject.model';
import {
  TIMETABLE_DAYS,
  TimetableDayOfWeek,
  TimetableEntry,
  TimetableScope,
} from '../../../models/timetable/timetable.model';
import { TimetableService } from '../../../service/timetable-service/timetable.service';
import { minuteTime, timetableError, validTimetablePeriod } from '../../../shared/timetable';

@Component({
  selector: 'app-timetable-entry-form',
  imports: [FormsModule],
  templateUrl: './timetable-entry-form.component.html',
  styleUrl: './timetable-entry-form.component.css',
})
export class TimetableEntryFormComponent {
  private readonly api = inject(TimetableService);
  private readonly destroyRef = inject(DestroyRef);
  readonly scope = input.required<TimetableScope>();
  readonly year = input.required<AcademicYear>();
  readonly entry = input<TimetableEntry | null>(null);
  readonly subjects = input<Subject[]>([]);
  readonly employees = input<Employee[]>([]);
  readonly canChooseTeacher = input(false);
  readonly allowed = input(false);
  readonly saved = output<TimetableEntry>();
  readonly cancelled = output<void>();
  readonly busyChange = output<boolean>();
  readonly dirtyChange = output<boolean>();
  protected readonly days = TIMETABLE_DAYS;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected subjectId = '';
  protected teacherId = '';
  protected dayOfWeek: TimetableDayOfWeek = 'MONDAY';
  protected startTime = '';
  protected endTime = '';
  protected validFrom = '';
  protected validUntil = '';
  protected roomCode = '';
  protected readonly activeEmployees = computed(() =>
    this.employees().filter(
      (employee) => employee.enabled && employee.establishmentId === this.scope().establishmentId,
    ),
  );
  protected readonly currentTeacherMissing = computed(
    () =>
      !!this.entry()?.teacherId &&
      !this.activeEmployees().some((employee) => employee.id === this.entry()?.teacherId),
  );

  constructor() {
    effect(() => {
      const entry = this.entry();
      const year = this.year();
      this.subjectId = entry?.subjectId ?? '';
      this.teacherId = entry?.teacherId ?? '';
      this.dayOfWeek = entry?.dayOfWeek ?? 'MONDAY';
      this.startTime = entry?.startTime.slice(0, 5) ?? '';
      this.endTime = entry?.endTime.slice(0, 5) ?? '';
      this.validFrom = entry?.validFrom ?? year.startsOn;
      this.validUntil = entry?.validUntil ?? year.endsOn;
      this.roomCode = entry?.roomCode ?? '';
    });
  }

  protected save(): void {
    if (this.saving() || !this.allowed()) return;
    this.error.set(null);
    const scope = this.scope();
    if (
      this.year().id !== scope.academicYearId ||
      this.year().establishmentId !== scope.establishmentId
    ) {
      this.error.set('L’année scolaire ne correspond pas à la salle sélectionnée.');
      return;
    }
    const entry = this.entry();
    if (
      entry &&
      (entry.establishmentId !== scope.establishmentId ||
        entry.academicYearId !== scope.academicYearId ||
        entry.schoolClassId !== scope.schoolClassId ||
        entry.classroomId !== scope.classroomId)
    ) {
      this.error.set('Ce créneau n’appartient pas à la salle sélectionnée.');
      return;
    }
    const start = minuteTime(this.startTime);
    const end = minuteTime(this.endTime);
    const from = this.validFrom || this.year().startsOn;
    const until = this.validUntil || this.year().endsOn;
    if (
      !start ||
      !end ||
      end <= start ||
      !validTimetablePeriod(this.year(), from, until, this.dayOfWeek)
    ) {
      this.error.set(
        'Choisissez des heures valides, avec une fin après le début, et une période de l’année contenant le jour choisi.',
      );
      return;
    }
    if (
      !this.subjects().some(
        (subject) =>
          subject.id === this.subjectId &&
          subject.enabled &&
          subject.establishmentId === scope.establishmentId,
      )
    ) {
      this.error.set('Choisissez une matière active affectée à cette classe.');
      return;
    }
    if (
      this.teacherId &&
      this.teacherId !== entry?.teacherId &&
      !this.activeEmployees().some((employee) => employee.id === this.teacherId)
    ) {
      this.error.set('Choisissez un membre du personnel actif de cet établissement.');
      return;
    }
    if (this.roomCode.trim().length > 40) {
      this.error.set('Le code du local ne doit pas dépasser 40 caractères.');
      return;
    }
    const request = {
      subjectId: this.subjectId,
      teacherId: this.teacherId || null,
      dayOfWeek: this.dayOfWeek,
      startTime: start,
      endTime: end,
      validFrom: from,
      validUntil: until,
      roomCode: this.roomCode.trim().toUpperCase() || null,
    };
    this.saving.set(true);
    this.busyChange.emit(true);
    const call = entry
      ? this.api.update(scope, entry.id, request)
      : this.api.create(scope, request);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.busyChange.emit(false);
        this.dirtyChange.emit(false);
        this.saved.emit(saved);
      },
      error: (error: unknown) => {
        this.error.set(timetableError(error));
        this.saving.set(false);
        this.busyChange.emit(false);
      },
    });
  }
}
