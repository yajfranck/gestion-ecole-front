import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { Classroom } from '../../../models/classroom/classroom.model';
import { Employee } from '../../../models/employee/employee.model';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import {
  CopyTimetableRequest,
  TimetableEntry,
  TimetableScope,
} from '../../../models/timetable/timetable.model';
import { ClassroomService } from '../../../service/classroom-service/classroom.service';
import { TimetableService } from '../../../service/timetable-service/timetable.service';
import { timetableError, validTimetablePeriod } from '../../../shared/timetable';

@Component({
  selector: 'app-timetable-copy-form',
  imports: [FormsModule],
  templateUrl: './timetable-copy-form.component.html',
  styleUrl: './timetable-copy-form.component.css',
})
export class TimetableCopyFormComponent implements OnInit, OnDestroy {
  private readonly api = inject(TimetableService);
  private readonly classroomsApi = inject(ClassroomService);
  private readonly destroyRef = inject(DestroyRef);
  private roomsRequest?: Subscription;
  private revision = 0;
  readonly scope = input.required<TimetableScope>();
  readonly year = input.required<AcademicYear>();
  readonly classes = input<SchoolClass[]>([]);
  readonly entries = input<TimetableEntry[]>([]);
  readonly employees = input<Employee[]>([]);
  readonly canChooseTeacher = input(false);
  readonly allowed = input(false);
  readonly canReplace = input(false);
  readonly saved = output<{ entries: TimetableEntry[]; target: Classroom }>();
  readonly cancelled = output<void>();
  readonly busyChange = output<boolean>();
  readonly dirtyChange = output<boolean>();
  protected readonly rooms = signal<Classroom[]>([]);
  protected readonly loadingRooms = signal(false);
  protected readonly roomsError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected targetClassId = '';
  protected targetClassroomId = '';
  protected replaceExisting = false;
  protected copyTeachers = false;
  protected copyRoomCodes = false;
  protected validFrom = '';
  protected validUntil = '';
  protected teacherMappings: Record<string, string> = {};
  protected readonly sourceTeachers = computed(() => [
    ...new Set(
      this.entries()
        .map((entry) => entry.teacherId)
        .filter((id): id is string => !!id),
    ),
  ]);
  protected readonly activeEmployees = computed(() =>
    this.employees().filter(
      (employee) => employee.enabled && employee.establishmentId === this.scope().establishmentId,
    ),
  );
  protected readonly activeClasses = computed(() =>
    this.classes().filter(
      (item) =>
        item.enabled &&
        item.establishmentId === this.scope().establishmentId &&
        item.academicYearId === this.scope().academicYearId,
    ),
  );
  ngOnInit(): void {
    this.targetClassId = this.scope().schoolClassId;
    this.loadRooms();
  }
  ngOnDestroy(): void {
    this.roomsRequest?.unsubscribe();
  }

  protected teacherName(id: string): string {
    const employee = this.activeEmployees().find((item) => item.id === id);
    return employee
      ? `${employee.firstName} ${employee.lastName}`
      : 'Enseignant du planning source';
  }
  protected loadRooms(): void {
    this.roomsRequest?.unsubscribe();
    const revision = ++this.revision;
    this.targetClassroomId = '';
    this.rooms.set([]);
    this.roomsError.set(null);
    if (!this.activeClasses().some((item) => item.id === this.targetClassId)) {
      this.loadingRooms.set(false);
      return;
    }
    this.loadingRooms.set(true);
    const scope = this.scope();
    const classId = this.targetClassId;
    this.roomsRequest = this.classroomsApi
      .list(scope.establishmentId, scope.academicYearId, classId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rooms) => {
          if (revision !== this.revision) return;
          this.rooms.set(
            rooms.filter(
              (room) =>
                room.enabled &&
                room.establishmentId === scope.establishmentId &&
                room.academicYearId === scope.academicYearId &&
                room.schoolClassId === classId &&
                room.id !== scope.classroomId,
            ),
          );
          this.loadingRooms.set(false);
        },
        error: (error: unknown) => {
          if (revision !== this.revision) return;
          this.loadingRooms.set(false);
          this.roomsError.set(timetableError(error));
        },
      });
  }
  protected save(): void {
    if (this.saving() || !this.allowed()) return;
    this.error.set(null);
    const target = this.rooms().find(
      (room) => room.id === this.targetClassroomId && room.schoolClassId === this.targetClassId,
    );
    if (!target || this.loadingRooms() || !this.entries().length) {
      this.error.set('Choisissez une autre salle active et un planning source non vide.');
      return;
    }
    if (this.replaceExisting && !this.canReplace()) {
      this.error.set('Le remplacement nécessite le droit d’archiver les créneaux.');
      return;
    }
    if (
      this.entries().some(
        (entry) =>
          !validTimetablePeriod(
            this.year(),
            this.validFrom || entry.validFrom,
            this.validUntil || entry.validUntil,
            entry.dayOfWeek,
          ),
      )
    ) {
      this.error.set(
        'La période doit appartenir à l’année et contenir une occurrence de chaque jour copié.',
      );
      return;
    }
    const mappings = Object.fromEntries(
      Object.entries(this.teacherMappings).filter(([, target]) => !!target),
    );
    if (
      Object.keys(mappings).length > 100 ||
      Object.entries(mappings).some(
        ([source, destination]) =>
          !this.canChooseTeacher() ||
          !this.sourceTeachers().includes(source) ||
          !this.activeEmployees().some((employee) => employee.id === destination),
      )
    ) {
      this.error.set('Vérifiez les réaffectations des enseignants du planning source.');
      return;
    }
    const request: CopyTimetableRequest = {
      targetClassroomId: target.id,
      replaceExisting: this.replaceExisting,
      copyTeachers: this.copyTeachers,
      copyRoomCodes: this.copyRoomCodes,
      ...(this.validFrom ? { validFrom: this.validFrom } : {}),
      ...(this.validUntil ? { validUntil: this.validUntil } : {}),
      ...(Object.keys(mappings).length ? { teacherMappings: mappings } : {}),
    };
    this.saving.set(true);
    this.busyChange.emit(true);
    this.api
      .copy(this.scope(), request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entries) => {
          this.saving.set(false);
          this.busyChange.emit(false);
          this.dirtyChange.emit(false);
          this.saved.emit({ entries, target });
        },
        error: (error: unknown) => {
          this.error.set(timetableError(error));
          this.saving.set(false);
          this.busyChange.emit(false);
        },
      });
  }
}
