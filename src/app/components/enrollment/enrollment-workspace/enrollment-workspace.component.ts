import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Enrollment } from '../../../models/enrollment/enrollment.model';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { Student } from '../../../models/student/student.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { EnrollmentService } from '../../../service/enrollment-service/enrollment.service';
import { StudentService } from '../../../service/student-service/student.service';

@Component({
  selector: 'app-enrollment-workspace',
  imports: [FormsModule, RouterLink],
  templateUrl: './enrollment-workspace.component.html',
  styleUrl: './enrollment-workspace.component.css'
})
export class EnrollmentWorkspaceComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
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
  protected readonly lastEnrollment = signal<Enrollment | null>(null);

  protected studentId = '';
  protected schoolClassId = '';
  private requestedStudentId = '';
  private requestedClassId = '';

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.establishmentId.set(params.get('establishmentId') ?? '');
    this.academicYearId.set(params.get('academicYearId') ?? '');
    this.requestedStudentId = this.route.snapshot.queryParamMap.get('studentId') ?? '';
    this.requestedClassId = this.route.snapshot.queryParamMap.get('classId') ?? '';
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    const establishmentId = this.establishmentId();
    const academicYearId = this.academicYearId();
    this.studentService.getStudents(establishmentId).subscribe({
      next: (students) => {
        this.students.set(students);
        this.academicYearService.getClasses(establishmentId, academicYearId).subscribe({
          next: (classes) => {
            this.classes.set(classes);
            this.enrollmentService.getEnrollments(establishmentId, academicYearId).subscribe({
              next: (enrollments) => {
                this.enrollments.set(enrollments);
                this.preselectRequestedStudent();
                this.isLoading.set(false);
              },
              error: (error: unknown) => this.failLoad(error)
            });
          },
          error: (error: unknown) => this.failLoad(error)
        });
      },
      error: (error: unknown) => this.failLoad(error)
    });
  }

  protected create(): void {
    if (!this.studentId || !this.schoolClassId || this.hasEnrollment(this.studentId) || this.isCreating()) return;

    this.actionError.set(null);
    this.successMessage.set(null);
    this.lastEnrollment.set(null);
    this.isCreating.set(true);
    this.enrollmentService.createEnrollment(this.establishmentId(), this.academicYearId(), {
      studentId: this.studentId,
      schoolClassId: this.schoolClassId
    }).subscribe({
      next: (enrollment) => {
        this.studentId = '';
        this.isCreating.set(false);
        this.lastEnrollment.set(enrollment);
        this.successMessage.set('L’inscription a été enregistrée.');
        this.reloadEnrollments();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error));
        this.isCreating.set(false);
      }
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
    this.enrollmentService.getEnrollments(this.establishmentId(), this.academicYearId()).subscribe({
      next: (enrollments) => this.enrollments.set(enrollments),
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
