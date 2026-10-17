import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClassStudent } from '../../../models/enrollment/enrollment.model';
import { SchoolClassSubject, Subject } from '../../../models/subject/subject.model';
import { EnrollmentService } from '../../../service/enrollment-service/enrollment.service';
import { SubjectService } from '../../../service/subject-service/subject.service';
import { Classroom } from '../../../models/classroom/classroom.model';
import { ClassroomManagerComponent } from '../../classroom/classroom-manager/classroom-manager.component';

@Component({
  selector: 'app-school-class-detail',
  imports: [FormsModule, RouterLink, ClassroomManagerComponent],
  templateUrl: './school-class-detail.component.html',
  styleUrl: './school-class-detail.component.css'
})
export class SchoolClassDetailComponent implements OnInit {
  private readonly subjectService = inject(SubjectService);
  private readonly enrollmentService = inject(EnrollmentService);

  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();
  readonly schoolClassId = input.required<string>();

  protected readonly subjects = signal<Subject[]>([]);
  protected readonly assignments = signal<SchoolClassSubject[]>([]);
  protected readonly students = signal<ClassStudent[]>([]);
  protected readonly isLoadingSubjects = signal(true);
  protected readonly isLoadingStudents = signal(true);
  protected readonly isMutating = signal(false);
  protected readonly subjectError = signal<string | null>(null);
  protected readonly studentError = signal<string | null>(null);
  protected selectedSubjectId = '';
  protected readonly classrooms = signal<Classroom[]>([]);
  protected classroomId = '';
  private studentsRevision = 0;

  protected setClassrooms(rooms: Classroom[]): void {
    this.classrooms.set(rooms);
    if (this.classroomId && !rooms.some((room) => room.id === this.classroomId)) {
      this.classroomId = '';
      this.loadStudents();
    }
  }

  protected readonly assignedSubjects = computed(() => {
    const byId = new Map(this.subjects().map((subject) => [subject.id, subject]));
    return this.assignments()
      .filter((assignment) => assignment.enabled)
      .map((assignment) => ({ assignment, subject: byId.get(assignment.subjectId) }));
  });

  protected readonly availableSubjects = computed(() => {
    const assigned = new Set(this.assignments().filter((item) => item.enabled).map((item) => item.subjectId));
    return this.subjects().filter((subject) => subject.enabled && !assigned.has(subject.id));
  });

  ngOnInit(): void {
    this.loadSubjects();
    this.loadStudents();
  }

  protected loadSubjects(): void {
    this.isLoadingSubjects.set(true);
    this.subjectError.set(null);
    this.subjectService.getSubjects(this.establishmentId()).subscribe({
      next: (subjects) => {
        this.subjects.set(subjects);
        this.subjectService.getClassSubjects(this.establishmentId(), this.academicYearId(), this.schoolClassId()).subscribe({
          next: (assignments) => {
            this.assignments.set(assignments);
            this.isLoadingSubjects.set(false);
          },
          error: (error: unknown) => this.failSubjects(error)
        });
      },
      error: (error: unknown) => this.failSubjects(error)
    });
  }

  protected loadStudents(): void {
    const revision = ++this.studentsRevision;
    this.isLoadingStudents.set(true);
    this.studentError.set(null);
    this.enrollmentService.getClassStudents(this.establishmentId(), this.academicYearId(), this.schoolClassId(), this.classroomId || undefined).subscribe({
      next: (students) => {
        if (revision !== this.studentsRevision) return;
        this.students.set(students);
        this.isLoadingStudents.set(false);
      },
      error: (error: unknown) => {
        if (revision !== this.studentsRevision) return;
        this.studentError.set(this.errorMessage(error));
        this.isLoadingStudents.set(false);
      }
    });
  }

  protected assign(): void {
    if (!this.selectedSubjectId || this.isMutating()) return;

    this.isMutating.set(true);
    this.subjectError.set(null);
    this.subjectService.assignSubject(this.establishmentId(), this.academicYearId(), this.schoolClassId(), this.selectedSubjectId).subscribe({
      next: () => {
        this.selectedSubjectId = '';
        this.isMutating.set(false);
        this.loadSubjects();
      },
      error: (error: unknown) => {
        this.subjectError.set(this.errorMessage(error));
        this.isMutating.set(false);
      }
    });
  }

  protected unassign(subjectId: string): void {
    if (this.isMutating()) return;

    this.isMutating.set(true);
    this.subjectError.set(null);
    this.subjectService.unassignSubject(this.establishmentId(), this.academicYearId(), this.schoolClassId(), subjectId).subscribe({
      next: () => {
        this.isMutating.set(false);
        this.loadSubjects();
      },
      error: (error: unknown) => {
        this.subjectError.set(this.errorMessage(error));
        this.isMutating.set(false);
      }
    });
  }

  private failSubjects(error: unknown): void {
    this.subjectError.set(this.errorMessage(error));
    this.isLoadingSubjects.set(false);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'La classe ou la matière est absente ou inaccessible.';
      if (error.status === 409) return 'Cette matière est déjà affectée à la classe.';
    }
    return 'Impossible de charger ou d’enregistrer ces informations. Vérifiez le serveur puis réessayez.';
  }
}
