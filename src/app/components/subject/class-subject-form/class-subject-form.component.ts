import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
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
import { Classroom } from '../../../models/classroom/classroom.model';
import { Employee } from '../../../models/employee/employee.model';
import { SchoolClassSubject, Subject } from '../../../models/subject/subject.model';
import { SubjectService } from '../../../service/subject-service/subject.service';

@Component({
  selector: 'app-class-subject-form',
  imports: [PermissionDirective, FormsModule],
  templateUrl: './class-subject-form.component.html',
  styleUrl: './class-subject-form.component.css',
})
export class ClassSubjectFormComponent {
  private readonly api = inject(SubjectService);
  private readonly destroyRef = inject(DestroyRef);
  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();
  readonly schoolClassId = input.required<string>();
  readonly subjects = input<Subject[]>([]);
  readonly classrooms = input<Classroom[]>([]);
  readonly employees = input<Employee[]>([]);
  readonly assignment = input<SchoolClassSubject | null>(null);
  readonly canConfigureTeachers = input(false);
  readonly loadingEmployees = input(false);
  readonly employeesError = input<string | null>(null);
  readonly retryEmployees = output<void>();
  readonly saved = output<SchoolClassSubject>();
  readonly cancelled = output<void>();
  readonly busyChange = output<boolean>();
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected selectedSubjectId = '';
  protected configureTeachers = false;
  protected teacherByClassroom: Record<string, string> = {};
  protected readonly activeRooms = computed(() =>
    this.classrooms().filter(
      (room) =>
        room.enabled &&
        room.establishmentId === this.establishmentId() &&
        room.academicYearId === this.academicYearId() &&
        room.schoolClassId === this.schoolClassId(),
    ),
  );
  protected readonly activeEmployees = computed(() =>
    this.employees().filter(
      (employee) => employee.enabled && employee.establishmentId === this.establishmentId(),
    ),
  );

  constructor() {
    effect(() => {
      const assignment = this.assignment();
      this.selectedSubjectId = assignment?.subjectId ?? '';
      this.configureTeachers = !!assignment;
      this.teacherByClassroom = Object.fromEntries(
        (assignment?.classroomTeachers ?? []).map((item) => [item.classroomId, item.employeeId]),
      );
    });
  }

  protected save(): void {
    if (this.saving()) return;
    this.error.set(null);
    const subject = this.subjects().find(
      (item) =>
        item.id === this.selectedSubjectId &&
        item.enabled &&
        item.establishmentId === this.establishmentId(),
    );
    if (!subject) {
      this.error.set('Choisissez une matière active de cet établissement.');
      return;
    }
    const configure = this.canConfigureTeachers() && this.configureTeachers;
    if (this.assignment() && !configure) {
      this.error.set('La consultation du personnel est nécessaire pour modifier les enseignants.');
      return;
    }
    if (
      configure &&
      (this.loadingEmployees() || this.employeesError() || !this.activeRooms().length)
    ) {
      this.error.set('Chargez les salles et le personnel avant d’enregistrer les enseignants.');
      return;
    }
    const classroomTeachers = this.activeRooms().flatMap((room) => {
      const employeeId = this.teacherByClassroom[room.id];
      return employeeId ? [{ classroomId: room.id, employeeId }] : [];
    });
    if (
      configure &&
      classroomTeachers.some(
        (item) => !this.activeEmployees().some((employee) => employee.id === item.employeeId),
      )
    ) {
      this.error.set('Choisissez uniquement des membres du personnel actifs de cet établissement.');
      return;
    }
    this.saving.set(true);
    this.busyChange.emit(true);
    this.api
      .assignSubject(
        this.establishmentId(),
        this.academicYearId(),
        this.schoolClassId(),
        subject.id,
        configure ? { classroomTeachers } : undefined,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (assignment) => {
          this.saving.set(false);
          this.busyChange.emit(false);
          this.saved.emit(assignment);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.busyChange.emit(false);
          this.error.set(
            error instanceof HttpErrorResponse && error.status === 403
              ? 'Votre compte ne dispose pas de l’autorisation d’affecter cette matière ou ses enseignants.'
              : error instanceof HttpErrorResponse && error.status === 404
                ? 'La matière, une salle ou un membre du personnel n’est plus disponible. Actualisez les données.'
                : error instanceof HttpErrorResponse && error.status === 409
                  ? 'Cette matière est déjà affectée ou une affectation a été modifiée simultanément. Actualisez puis réessayez.'
                  : 'Impossible d’enregistrer l’affectation. Vérifiez les salles et le personnel sélectionnés puis réessayez.',
          );
        },
      });
  }
}
