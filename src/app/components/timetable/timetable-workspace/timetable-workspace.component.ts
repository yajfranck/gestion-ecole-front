import { ToastService } from '../../../service/toast-service/toast.service';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LucideCalendarDays,
  LucideChevronLeft,
  LucideChevronRight,
  LucideRefreshCw,
} from '@lucide/angular';
import { forkJoin, of, Subscription } from 'rxjs';
import { LicenseAccessService } from '../../../core/license-access.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { Classroom } from '../../../models/classroom/classroom.model';
import { Employee } from '../../../models/employee/employee.model';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { SchoolClassSubject, Subject } from '../../../models/subject/subject.model';
import {
  TIMETABLE_DAYS,
  TimetableColumn,
  TimetableDay,
  TimetableEntry,
  TimetableScope,
  TimetableWeek,
} from '../../../models/timetable/timetable.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { ClassroomService } from '../../../service/classroom-service/classroom.service';
import { EmployeeService } from '../../../service/employee-service/employee.service';
import { SubjectService } from '../../../service/subject-service/subject.service';
import { TimetableService } from '../../../service/timetable-service/timetable.service';
import { DialogComponent } from '../../../shared/dialog/dialog.component';
import { localDateKey } from '../../../shared/date-range';
import { PendingChangesService } from '../../../shared/pending-changes.service';
import { dateInYear, shiftCalendarDate, timetableError } from '../../../shared/timetable';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { TimetableBoardComponent } from '../timetable-board/timetable-board.component';
import { TimetableCopyFormComponent } from '../timetable-copy-form/timetable-copy-form.component';
import { TimetableDaysFormComponent } from '../timetable-days-form/timetable-days-form.component';
import { TimetableEntryFormComponent } from '../timetable-entry-form/timetable-entry-form.component';

type View = 'week' | 'day' | 'model';
type Editor = 'entry' | 'copy' | 'days';

// Les dates du calendrier sont des dates civiles, sans conversion de fuseau horaire.
function mondayOf(date: string): string {
  return shiftCalendarDate(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
}
function calendarLabel(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
@Component({
  selector: 'app-timetable-workspace',
  imports: [
    RouterLink,
    LucideCalendarDays,
    LucideChevronLeft,
    LucideChevronRight,
    LucideRefreshCw,
    DialogComponent,
    TimetableBoardComponent,
    TimetableEntryFormComponent,
    TimetableCopyFormComponent,
    TimetableDaysFormComponent,
  ],
  templateUrl: './timetable-workspace.component.html',
  styleUrl: './timetable-workspace.component.css',
})
export class TimetableWorkspaceComponent implements OnDestroy {
  private readonly toast = inject(ToastService);
  private readonly confirmation = inject(ConfirmationDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap);
  private readonly destroyRef = inject(DestroyRef);
  private readonly context = inject(WorkspaceContextService);
  private readonly access = inject(WorkspaceAccessService);
  private readonly license = inject(LicenseAccessService);
  private readonly years = inject(AcademicYearService);
  private readonly roomsApi = inject(ClassroomService);
  private readonly employeesApi = inject(EmployeeService);
  private readonly subjectsApi = inject(SubjectService);
  private readonly api = inject(TimetableService);
  protected readonly pending = inject(PendingChangesService);
  protected readonly year = this.context.academicYear;
  protected readonly establishmentId = computed(() => this.params()?.get('establishmentId') ?? '');
  protected readonly academicYearId = computed(() => this.params()?.get('academicYearId') ?? '');
  protected readonly canRead = computed(
    () =>
      this.year()?.id === this.academicYearId() &&
      this.year()?.establishmentId === this.establishmentId() &&
      this.can('read'),
  );
  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly rooms = signal<Classroom[]>([]);
  protected readonly classId = signal('');
  protected readonly classroomId = signal('');
  protected readonly entries = signal<TimetableEntry[]>([]);
  protected readonly datedDays = signal<TimetableDay[]>([]);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly assignments = signal<SchoolClassSubject[]>([]);
  protected readonly employees = signal<Employee[]>([]);
  protected readonly loadingClasses = signal(false);
  protected readonly loadingRooms = signal(false);
  protected readonly loadingPlanning = signal(false);
  protected readonly loadingReferences = signal(false);
  protected readonly loadingEmployees = signal(false);
  protected readonly classesError = signal<string | null>(null);
  protected readonly roomsError = signal<string | null>(null);
  protected readonly referencesError = signal<string | null>(null);
  protected readonly employeesError = signal<string | null>(null);
  protected readonly planningError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly editor = signal<Editor | null>(null);
  protected readonly selectedEntry = signal<TimetableEntry | null>(null);
  protected readonly view = signal<View>('week');
  protected readonly date = signal('');
  protected readonly today = localDateKey();
  protected readonly todayInYear = computed(() => {
    const year = this.year();
    return !!year && dateInYear(this.today, year);
  });
  protected readonly periodStart = computed(() =>
    this.date() && this.view() === 'week' ? mondayOf(this.date()) : this.date(),
  );
  protected readonly periodEnd = computed(() =>
    this.periodStart() && this.view() === 'week'
      ? shiftCalendarDate(this.periodStart(), 6)
      : this.date(),
  );
  protected readonly canGoPrevious = computed(
    () => !!this.year() && !!this.periodStart() && this.periodStart() > this.year()!.startsOn,
  );
  protected readonly canGoNext = computed(
    () => !!this.year() && !!this.periodEnd() && this.periodEnd() < this.year()!.endsOn,
  );
  protected readonly periodLabel = computed(() => {
    const start = this.periodStart();
    const end = this.periodEnd();
    if (!start || !end) return '';
    const full = { day: 'numeric', month: 'long', year: 'numeric' } as const;
    if (this.view() === 'day') return calendarLabel(start, { ...full, weekday: 'long' });
    const startOptions: Intl.DateTimeFormatOptions =
      start.slice(0, 4) !== end.slice(0, 4)
        ? full
        : start.slice(0, 7) !== end.slice(0, 7)
          ? { day: 'numeric', month: 'long' }
          : { day: 'numeric' };
    return `${calendarLabel(start, startOptions)} – ${calendarLabel(end, full)}`;
  });
  protected readonly copiedTarget = signal<Classroom | null>(null);
  protected trigger: HTMLElement | null = null;
  protected readonly scope = computed<TimetableScope | null>(() => {
    const schoolClass = this.classes().find((item) => item.id === this.classId());
    const room = this.rooms().find(
      (item) => item.id === this.classroomId() && item.schoolClassId === schoolClass?.id,
    );
    return schoolClass && room
      ? {
          establishmentId: this.establishmentId(),
          academicYearId: this.academicYearId(),
          schoolClassId: schoolClass.id,
          classroomId: room.id,
        }
      : null;
  });
  protected readonly assignedSubjects = computed(() => {
    const ids = new Set(
      this.assignments()
        .filter(
          (item) =>
            item.enabled &&
            item.establishmentId === this.establishmentId() &&
            item.schoolClassId === this.classId(),
        )
        .map((item) => item.subjectId),
    );
    return this.subjects().filter((item) => item.enabled && ids.has(item.id));
  });
  protected readonly canReadEmployees = computed(() => this.access.hasPermission('can_employee_read', this.establishmentId()));
  protected readonly canChooseTeacher = computed(
    () => this.canReadEmployees() && !this.loadingEmployees() && !this.employeesError(),
  );
  protected readonly columns = computed<TimetableColumn[]>(() =>
    this.view() === 'model'
      ? TIMETABLE_DAYS.map((day) => ({
          key: day.value,
          label: day.label,
          withinAcademicYear: true,
          nonWorkingDay: null,
          entries: this.entries().filter((entry) => entry.dayOfWeek === day.value),
        }))
      : this.datedDays().map((day) => ({
          key: day.date,
          label: TIMETABLE_DAYS[(new Date(`${day.date}T00:00:00Z`).getUTCDay() + 6) % 7].label,
          ...day,
        })),
  );
  private contextKey = '';
  private contextRevision = 0;
  private classRevision = 0;
  private planningRevision = 0;
  private classesRequest?: Subscription;
  private roomsRequest?: Subscription;
  private referencesRequest?: Subscription;
  private employeesRequest?: Subscription;
  private planningRequest?: Subscription;
  private archiveRequest?: Subscription;

  constructor() {
    this.toast.connect(this.success, 'success');
    this.toast.connect(this.actionError, 'error');
    effect(() => {
      const key = this.canRead() ? `${this.establishmentId()}/${this.academicYearId()}` : '';
      untracked(() => {
        if (key === this.contextKey) return;
        this.contextKey = key;
        this.reset();
        if (key) {
          this.loadClasses();
          if (this.canReadEmployees()) this.loadEmployees();
        }
      });
    });
  }
  ngOnDestroy(): void {
    this.reset();
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.pending.dirty() || this.pending.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  protected can(action: string): boolean {
    if (['create', 'update'].includes(action) && !this.access.hasAllPermissions(['can_subject_read', 'can_class_subject_read'], this.establishmentId())) return false;
    return this.license.canUse(
      `can_timetable_${action}`,
      'SCHOOL_MANAGEMENT',
      this.establishmentId(),
    );
  }
  private reset(): void {
    this.contextRevision++;
    this.classRevision++;
    this.planningRevision++;
    for (const request of [
      this.classesRequest,
      this.roomsRequest,
      this.referencesRequest,
      this.employeesRequest,
      this.planningRequest,
      this.archiveRequest,
    ])
      request?.unsubscribe();
    this.classes.set([]);
    this.rooms.set([]);
    this.entries.set([]);
    this.datedDays.set([]);
    this.subjects.set([]);
    this.assignments.set([]);
    this.employees.set([]);
    this.classId.set('');
    this.classroomId.set('');
    this.editor.set(null);
    this.selectedEntry.set(null);
    this.copiedTarget.set(null);
    this.classesError.set(null);
    this.roomsError.set(null);
    this.planningError.set(null);
    this.referencesError.set(null);
    this.employeesError.set(null);
    this.actionError.set(null);
    this.success.set(null);
    this.loadingClasses.set(false);
    this.loadingRooms.set(false);
    this.loadingPlanning.set(false);
    this.loadingReferences.set(false);
    this.loadingEmployees.set(false);
    this.pending.dirty.set(false);
    this.pending.saving.set(false);
    const year = this.year();
    const today = localDateKey();
    this.date.set(
      year
        ? today < year.startsOn
          ? year.startsOn
          : today > year.endsOn
            ? year.endsOn
            : today
        : today,
    );
  }
  protected loadClasses(): void {
    if (!this.canRead() || this.pending.saving()) return;
    this.classesRequest?.unsubscribe();
    this.loadingClasses.set(true);
    this.classesError.set(null);
    const revision = this.contextRevision;
    const school = this.establishmentId();
    const yearId = this.academicYearId();
    this.classesRequest = this.years
      .getClasses(school, yearId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (classes) => {
          if (revision !== this.contextRevision) return;
          const active = classes.filter(
            (item) =>
              item.enabled && item.establishmentId === school && item.academicYearId === yearId,
          );
          this.classes.set(active);
          this.loadingClasses.set(false);
          const requested = this.route.snapshot.queryParamMap.get('classId');
          this.selectClass(
            active.find((item) => item.id === requested)?.id ?? active[0]?.id ?? '',
            this.route.snapshot.queryParamMap.get('classroomId') ?? '',
          );
        },
        error: (error: unknown) => {
          if (revision !== this.contextRevision) return;
          this.classesError.set(timetableError(error));
          this.loadingClasses.set(false);
        },
      });
  }
  protected changeClass(value: string, select: HTMLSelectElement): void {
    if (!this.pending.confirmLeave(() => this.changeClass(value, select))) {
      select.value = this.classId();
      return;
    }
    this.selectClass(value);
  }
  private selectClass(value: string, requestedRoom = ''): void {
    this.roomsRequest?.unsubscribe();
    this.referencesRequest?.unsubscribe();
    this.planningRequest?.unsubscribe();
    const revision = ++this.classRevision;
    this.planningRevision++;
    this.editor.set(null);
    this.selectedEntry.set(null);
    this.pending.dirty.set(false);
    this.classId.set(this.classes().some((item) => item.id === value) ? value : '');
    this.classroomId.set('');
    this.rooms.set([]);
    this.entries.set([]);
    this.datedDays.set([]);
    this.subjects.set([]);
    this.assignments.set([]);
    this.roomsError.set(null);
    this.referencesError.set(null);
    this.planningError.set(null);
    this.actionError.set(null);
    this.success.set(null);
    this.copiedTarget.set(null);
    this.loadingPlanning.set(false);
    this.loadingRooms.set(false);
    this.loadingReferences.set(false);
    if (!this.classId() || !this.canRead()) return;
    const school = this.establishmentId();
    const yearId = this.academicYearId();
    const classId = this.classId();
    this.loadingRooms.set(true);
    this.loadReferences();
    this.roomsRequest = this.roomsApi
      .list(school, yearId, classId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rooms) => {
          if (revision !== this.classRevision) return;
          const active = rooms.filter(
            (room) =>
              room.enabled &&
              room.establishmentId === school &&
              room.academicYearId === yearId &&
              room.schoolClassId === classId,
          );
          this.rooms.set(active);
          this.loadingRooms.set(false);
          this.classroomId.set(
            active.find((room) => room.id === requestedRoom)?.id ?? active[0]?.id ?? '',
          );
          this.loadPlanning();
        },
        error: (error: unknown) => {
          if (revision !== this.classRevision) return;
          this.roomsError.set(timetableError(error));
          this.loadingRooms.set(false);
        },
      });
  }
  protected retryRooms(): void {
    if (this.pending.confirmLeave(() => this.retryRooms())) this.selectClass(this.classId());
  }
  protected changeRoom(value: string, select: HTMLSelectElement): void {
    if (!this.pending.confirmLeave(() => this.changeRoom(value, select))) {
      select.value = this.classroomId();
      return;
    }
    this.editor.set(null);
    this.selectedEntry.set(null);
    this.actionError.set(null);
    this.success.set(null);
    this.copiedTarget.set(null);
    this.classroomId.set(this.rooms().some((room) => room.id === value) ? value : '');
    this.loadPlanning();
  }
  protected loadReferences(): void {
    if (!this.classId() || !this.canRead()) return;
    this.referencesRequest?.unsubscribe();
    this.loadingReferences.set(true);
    this.referencesError.set(null);
    const revision = this.classRevision;
    const school = this.establishmentId();
    const classId = this.classId();
    this.referencesRequest = forkJoin({
      subjects: this.access.hasPermission('can_subject_read', school) ? this.subjectsApi.getSubjects(school) : of([]),
      assignments: this.access.hasPermission('can_class_subject_read', school) ? this.subjectsApi.getClassSubjects(school, this.academicYearId(), classId) : of([]),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ subjects, assignments }) => {
          if (revision !== this.classRevision) return;
          this.subjects.set(
            subjects.filter((item) => item.enabled && item.establishmentId === school),
          );
          this.assignments.set(assignments);
          this.loadingReferences.set(false);
        },
        error: (error: unknown) => {
          if (revision !== this.classRevision) return;
          this.referencesError.set(timetableError(error));
          this.loadingReferences.set(false);
        },
      });
  }
  protected loadEmployees(): void {
    if (!this.canRead() || !this.canReadEmployees()) return;
    this.employeesRequest?.unsubscribe();
    this.loadingEmployees.set(true);
    this.employeesError.set(null);
    const revision = this.contextRevision;
    const school = this.establishmentId();
    this.employeesRequest = this.employeesApi
      .getEmployees(this.establishmentId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (employees) => {
          if (revision !== this.contextRevision) return;
          this.employees.set(
            employees.filter((employee) => employee.enabled && employee.establishmentId === school),
          );
          this.loadingEmployees.set(false);
        },
        error: (error: unknown) => {
          if (revision !== this.contextRevision) return;
          this.employeesError.set(timetableError(error));
          this.loadingEmployees.set(false);
        },
      });
  }
  protected setView(view: View): void {
    if (this.pending.saving()) return;
    this.view.set(view);
    this.loadPlanning();
  }
  protected changeDate(value: string, input?: HTMLInputElement): void {
    if (this.pending.saving()) return;
    const year = this.year();
    if (!year || !dateInYear(value, year)) {
      if (input) input.value = this.date();
      this.actionError.set('Choisissez une date comprise dans l’année scolaire.');
      return;
    }
    this.date.set(value);
    this.actionError.set(null);
    this.loadPlanning();
  }
  protected shiftDate(direction: number): void {
    const year = this.year();
    if (
      !year ||
      this.pending.saving() ||
      this.view() === 'model' ||
      (direction < 0 ? !this.canGoPrevious() : !this.canGoNext())
    )
      return;
    const next = shiftCalendarDate(
      this.periodStart(),
      direction * (this.view() === 'week' ? 7 : 1),
    );
    this.changeDate(next < year.startsOn ? year.startsOn : next > year.endsOn ? year.endsOn : next);
  }
  protected goToday(): void {
    if (this.todayInYear()) this.changeDate(this.today);
  }
  protected loadPlanning(): void {
    this.planningRequest?.unsubscribe();
    const revision = ++this.planningRevision;
    this.entries.set([]);
    this.datedDays.set([]);
    this.planningError.set(null);
    this.loadingPlanning.set(false);
    const scope = this.scope();
    const year = this.year();
    if (!scope || !year || !this.canRead()) return;
    if (!dateInYear(this.date(), year)) {
      this.planningError.set('Choisissez une date comprise dans l’année scolaire.');
      return;
    }
    this.loadingPlanning.set(true);
    const mode = this.view();
    const dated =
      mode === 'week'
        ? this.api.week(scope, this.date())
        : mode === 'day'
          ? this.api.day(scope, this.date())
          : of(null);
    this.planningRequest = forkJoin({ entries: this.api.list(scope), dated })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ entries, dated }) => {
          if (revision !== this.planningRevision) return;
          this.entries.set(
            entries.filter((entry) => entry.enabled && this.entryInScope(entry, scope)),
          );
          const days = dated
            ? 'days' in dated
              ? (dated as TimetableWeek).days
              : [dated as TimetableDay]
            : [];
          this.datedDays.set(
            days.map((day) => ({
              ...day,
              entries: day.entries.filter(
                (entry) => entry.enabled && this.entryInScope(entry, scope),
              ),
            })),
          );
          this.loadingPlanning.set(false);
        },
        error: (error: unknown) => {
          if (revision !== this.planningRevision) return;
          this.planningError.set(timetableError(error));
          this.loadingPlanning.set(false);
        },
      });
  }
  private entryInScope(entry: TimetableEntry, scope: TimetableScope): boolean {
    return (
      entry.establishmentId === scope.establishmentId &&
      entry.academicYearId === scope.academicYearId &&
      entry.schoolClassId === scope.schoolClassId &&
      entry.classroomId === scope.classroomId
    );
  }
  protected openEditor(editor: Editor, trigger?: HTMLElement): void {
    if (this.pending.saving() || !this.canRead()) return;
    if (
      (editor === 'entry' &&
        (!this.scope() ||
          !this.can('create') ||
          this.loadingReferences() ||
          !!this.referencesError())) ||
      (editor === 'copy' && (!this.scope() || !this.can('copy') || !this.entries().length)) ||
      (editor === 'days' && !this.access.hasPermission('can_timetable_update', this.establishmentId()))
    )
      return;
    if (!this.pending.confirmLeave(() => this.openEditor(editor, trigger))) return;
    this.selectedEntry.set(null);
    this.editor.set(editor);
    this.trigger = trigger ?? null;
    this.pending.dirty.set(false);
    this.actionError.set(null);
  }
  protected editEntry(entry: TimetableEntry): void {
    const scope = this.scope();
    if (
      !scope ||
      !this.canRead() ||
      !this.can('update') ||
      !this.entryInScope(entry, scope) ||
      this.pending.saving() ||
      this.loadingReferences() ||
      this.referencesError() ||
      !this.pending.confirmLeave(() => this.editEntry(entry))
    )
      return;
    this.selectedEntry.set(entry);
    this.editor.set('entry');
    this.trigger = null;
    this.pending.dirty.set(false);
    this.actionError.set(null);
  }
  protected closeEditor(): void {
    if (!this.pending.confirmLeave(() => this.closeEditor())) return;
    this.editor.set(null);
    this.selectedEntry.set(null);
  }
  protected saved(message: string): void {
    this.pending.dirty.set(false);
    this.pending.saving.set(false);
    this.editor.set(null);
    this.selectedEntry.set(null);
    this.copiedTarget.set(null);
    this.success.set(message);
    this.loadPlanning();
  }
  protected copySaved(result: { entries: TimetableEntry[]; target: Classroom }): void {
    this.saved(`${result.entries.length} créneau(x) copié(s) vers « ${result.target.name} ».`);
    this.copiedTarget.set(result.target);
  }
  protected showCopied(): void {
    const target = this.copiedTarget();
    if (target && this.pending.confirmLeave(() => this.showCopied())) this.selectClass(target.schoolClassId, target.id);
  }
  protected archive(entry: TimetableEntry): void {
    const scope = this.scope();
    if (
      !scope ||
      !this.canRead() ||
      !this.can('delete') ||
      !this.entryInScope(entry, scope) ||
      this.pending.saving()
    )
      return;

    
    this.confirmation.confirm('Archiver ce créneau récurrent pour toute sa période de validité ?', () => {
    this.pending.saving.set(true);
    this.actionError.set(null);
    this.success.set(null);
    const revision = this.contextRevision;
    this.archiveRequest = this.api
      .archive(scope, entry.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (revision !== this.contextRevision) return;
          this.pending.saving.set(false);
          this.copiedTarget.set(null);
          this.success.set('Le créneau a été archivé.');
          this.loadPlanning();
        },
        error: (error: unknown) => {
          if (revision !== this.contextRevision) return;
          this.pending.saving.set(false);
          this.actionError.set(timetableError(error));
        },
      });

    });
  }
}
