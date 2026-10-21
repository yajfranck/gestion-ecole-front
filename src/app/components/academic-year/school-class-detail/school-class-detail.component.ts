import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { Classroom } from '../../../models/classroom/classroom.model';
import { ClassStudent } from '../../../models/enrollment/enrollment.model';
import { ClassroomService } from '../../../service/classroom-service/classroom.service';
import { EnrollmentService } from '../../../service/enrollment-service/enrollment.service';
import { apiError } from '../../../shared/api-error';

@Component({
  selector: 'app-school-class-detail',
  imports: [FormsModule, RouterLink],
  templateUrl: './school-class-detail.component.html',
  styleUrl: './school-class-detail.component.css'
})
export class SchoolClassDetailComponent implements OnInit {
  protected readonly access = inject(WorkspaceAccessService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly roomsApi = inject(ClassroomService);
  private readonly destroyRef = inject(DestroyRef);
  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();
  readonly schoolClassId = input.required<string>();
  protected readonly students = signal<ClassStudent[]>([]);
  protected readonly classrooms = signal<Classroom[]>([]);
  protected readonly isLoadingStudents = signal(true);
  protected readonly studentError = signal<string | null>(null);
  protected readonly roomsError = signal<string | null>(null);
  protected classroomId = '';
  private studentsRevision = 0;
  private roomsRevision = 0;

  ngOnInit(): void { this.loadRooms(); this.loadStudents(); }

  setClassrooms(rooms: Classroom[]): void {
    this.roomsRevision++;
    this.classrooms.set(rooms.filter(room => room.enabled && room.establishmentId === this.establishmentId() && room.academicYearId === this.academicYearId() && room.schoolClassId === this.schoolClassId()));
    this.roomsError.set(null);
    if (this.classroomId && !this.classrooms().some(room => room.id === this.classroomId)) { this.classroomId = ''; this.loadStudents(); }
  }

  protected loadRooms(): void {
    if (!this.access.hasPermission('can_school_class_read', this.establishmentId())) return;
    const revision = ++this.roomsRevision;
    this.roomsError.set(null);
    this.roomsApi.list(this.establishmentId(), this.academicYearId(), this.schoolClassId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rooms => { if (revision === this.roomsRevision) this.setClassrooms(rooms); },
      error: (error: unknown) => { if (revision === this.roomsRevision) this.roomsError.set(apiError(error)); }
    });
  }

  protected loadStudents(): void {
    if (!this.access.hasPermission('can_enrollment_read', this.establishmentId())) { this.isLoadingStudents.set(false); return; }
    const revision = ++this.studentsRevision;
    this.isLoadingStudents.set(true); this.studentError.set(null);
    this.enrollmentService.getClassStudents(this.establishmentId(), this.academicYearId(), this.schoolClassId(), this.classroomId || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: students => { if (revision === this.studentsRevision) { this.students.set(students); this.isLoadingStudents.set(false); } },
      error: (error: unknown) => { if (revision === this.studentsRevision) { this.studentError.set(apiError(error)); this.isLoadingStudents.set(false); } }
    });
  }
}
