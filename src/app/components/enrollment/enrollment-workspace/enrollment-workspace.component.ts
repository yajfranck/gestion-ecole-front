import { ToastService } from '../../../service/toast-service/toast.service';
import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, forkJoin, of, Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Enrollment, EnrollmentCreation } from '../../../models/enrollment/enrollment.model';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { Student } from '../../../models/student/student.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { EnrollmentService } from '../../../service/enrollment-service/enrollment.service';
import { StudentService } from '../../../service/student-service/student.service';
import { EnrollmentFormComponent } from '../enrollment-form/enrollment-form.component';
import { ClassroomService } from '../../../service/classroom-service/classroom.service';
import { Classroom } from '../../../models/classroom/classroom.model';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';

@Component({
  selector: 'app-enrollment-workspace',
  imports: [FormModalComponent, PermissionDirective, FormsModule, RouterLink, EnrollmentFormComponent],
  templateUrl: './enrollment-workspace.component.html',
  styleUrl: './enrollment-workspace.component.css'
})
export class EnrollmentWorkspaceComponent {
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private loadRevision = 0;
  private loadSubscription?: Subscription;
  private readonly classroomService = inject(ClassroomService);
  protected readonly access = inject(WorkspaceAccessService);
  protected readonly roomsByClass = signal<Record<string, Classroom[]>>({});
  protected readonly roomsError = signal<string | null>(null);
  protected readonly changingId = signal<string | null>(null);
  protected readonly moving = signal(false);
  protected targetRoomId = '';
  protected requestedClassroomId = '';
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(combineLatest([this.route.paramMap, this.route.queryParamMap]));
  private readonly academicYearService = inject(AcademicYearService);
  private readonly studentService = inject(StudentService);
  private readonly enrollmentService = inject(EnrollmentService);

  protected readonly establishmentId = signal('');
  protected readonly academicYearId = signal('');
  protected readonly students = signal<Student[]>([]);
  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly enrollments = signal<Enrollment[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isCreating = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly lastEnrollment = signal<EnrollmentCreation | null>(null);

  protected studentId = '';
  protected schoolClassId = '';
  private requestedStudentId = '';
  private requestedClassId = '';

  constructor() {
    this.toast.connect(this.successMessage, 'success');
    this.toast.connect(this.actionError, 'error');
    effect(() => {
      const params = this.params();
      if (!params) return;
      untracked(() => {
        this.establishmentId.set(params[0].get('establishmentId') ?? '');
        this.academicYearId.set(params[0].get('academicYearId') ?? '');
        this.requestedStudentId = params[1].get('studentId') ?? '';
        this.requestedClassId = params[1].get('classId') ?? '';
        this.requestedClassroomId = params[1].get('classroomId') ?? '';
        this.studentId = ''; this.schoolClassId = ''; this.lastEnrollment.set(null); this.successMessage.set(null); this.actionError.set(null);
        this.changingId.set(null); this.load();
      });
    });
  }

  protected load(): void {
    const version = ++this.loadRevision;
    this.loadSubscription?.unsubscribe();
    this.isLoading.set(true); this.loadError.set(null); this.roomsByClass.set({});
    const establishmentId = this.establishmentId();
    const yearId = this.academicYearId();
    this.loadSubscription = forkJoin({ students: this.access.hasPermission('can_student_read', establishmentId) ? this.studentService.getStudents(establishmentId) : of([]),
      classes: this.access.hasPermission('can_school_class_read', establishmentId) ? this.academicYearService.getClasses(establishmentId, yearId) : of([]),
      enrollments: this.access.hasPermission('can_enrollment_read', establishmentId) ? this.enrollmentService.getEnrollments(establishmentId, yearId) : of([])
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ students, classes, enrollments }) => {
        if (version !== this.loadRevision) return;
        this.students.set(students.filter((student) => student.enabled && student.establishmentId === establishmentId));
        this.classes.set(classes.filter((item) => item.enabled && item.establishmentId === establishmentId && item.academicYearId === yearId));
        this.enrollments.set(enrollments); this.loadRoomsForEnrollments(enrollments); this.preselectRequestedStudent(); this.isLoading.set(false);
      }, error: (error: unknown) => { if (version === this.loadRevision) this.failLoad(error); }
    });
  }

  protected onCreated(enrollment: EnrollmentCreation): void {
    this.studentId = '';
    this.schoolClassId = '';
    this.lastEnrollment.set(enrollment);
    this.successMessage.set('L’inscription et ses règlements ont été enregistrés.');
    this.reloadEnrollments();
  }

  private loadRoomsForEnrollments(enrollments: Enrollment[]): void {
    if (!this.access.hasPermission('can_school_class_read', this.establishmentId())) return;
    const version = this.loadRevision;
    this.roomsError.set(null);
    for (const classId of new Set(enrollments.map((item) => item.schoolClassId))) {
      this.classroomService.list(this.establishmentId(), this.academicYearId(), classId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (rooms) => { if (version !== this.loadRevision) return; this.roomsByClass.update((current) => ({ ...current, [classId]: rooms.filter((room) => room.enabled && room.schoolClassId === classId && room.establishmentId === this.establishmentId() && room.academicYearId === this.academicYearId()) })); },
        error: () => { if (version === this.loadRevision) this.roomsError.set('Certaines salles sont indisponibles. Actualisez les inscriptions pour réessayer.'); }
      });
    }
  }

  protected roomNameFor(enrollment: Enrollment): string {
    return this.roomsByClass()[enrollment.schoolClassId]?.find((room) => room.id === enrollment.classroomId)?.name ?? 'Salle indisponible';
  }

  protected roomOccupancy(roomId: string, excludedEnrollmentId: string): number {
    return this.enrollments().filter((item) => item.classroomId === roomId && item.id !== excludedEnrollmentId).length;
  }

  protected startChangingRoom(enrollment: Enrollment): void {
    if (!this.access.hasPermission('can_enrollment_update', this.establishmentId())) return;
    this.changingId.set(enrollment.id); this.targetRoomId = enrollment.classroomId; this.actionError.set(null);
  }

  protected changeRoom(enrollment: Enrollment): void {
    if (this.moving() || !this.access.hasPermission('can_enrollment_update', this.establishmentId()) || !this.roomsByClass()[enrollment.schoolClassId]?.some((room) => room.id === this.targetRoomId)) return;
    const targetRoom = this.roomsByClass()[enrollment.schoolClassId]?.find((room) => room.id === this.targetRoomId);
    if (targetRoom && this.roomOccupancy(targetRoom.id, enrollment.id) >= targetRoom.maxStudents) {
      this.actionError.set('La salle choisie a atteint sa capacité maximale. Choisissez une autre salle.');
      return;
    }
    this.moving.set(true); this.actionError.set(null);
    this.enrollmentService.changeClassroom(this.establishmentId(), this.academicYearId(), enrollment.id, this.targetRoomId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => { this.enrollments.update((items) => items.map((item) => item.id === updated.id ? updated : item)); this.changingId.set(null); this.moving.set(false); },
      error: (error: unknown) => { this.actionError.set(error instanceof HttpErrorResponse && error.status === 409 ? 'La salle a peut-être atteint sa capacité ou un conflit empêche le changement. Actualisez les inscriptions avant de réessayer.' : this.errorMessage(error)); this.moving.set(false); }
    });
  }

  protected hasEnrollment(studentId: string): boolean {
    return this.enrollments().some((enrollment) => enrollment.studentId === studentId);
  }

  // Ne préremplit que des élèves/classes connus ; l'élève ne doit pas être déjà inscrit.
  private preselectRequestedStudent(): void {
    const id = this.requestedStudentId;
    const classId = this.requestedClassId;
    this.requestedStudentId = '';
    this.requestedClassId = '';
    if (classId && this.classes().some((item) => item.id === classId)) {
      this.schoolClassId = classId;
    }
    if (id && this.students().some((student) => student.id === id) && !this.hasEnrollment(id)) {
      this.studentId = id;
    }
  }

  protected studentNameFor(studentId: string): string {
    const student = this.students().find((item) => item.id === studentId);
    return student ? `${student.firstName} ${student.lastName}` : 'Élève indisponible';
  }

  protected classNameFor(schoolClassId: string): string {
    return this.classes().find((item) => item.id === schoolClassId)?.name ?? 'Classe indisponible';
  }

  private reloadEnrollments(): void {
    if (!this.access.hasPermission('can_enrollment_read', this.establishmentId())) return;
    this.enrollmentService.getEnrollments(this.establishmentId(), this.academicYearId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (enrollments) => { this.enrollments.set(enrollments); this.loadRoomsForEnrollments(enrollments); },
      error: (error: unknown) => this.actionError.set(this.errorMessage(error))
    });
  }

  private failLoad(error: unknown): void {
    this.loadError.set(this.errorMessage(error));
    this.isLoading.set(false);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'Cet élève ou cette classe est absent ou inaccessible.';
      if (error.status === 409) return 'Cet élève est déjà inscrit pour cette année scolaire.';
    }
    return 'Impossible de charger ou d’enregistrer ces informations. Vérifiez le serveur puis réessayez.';
  }
}
