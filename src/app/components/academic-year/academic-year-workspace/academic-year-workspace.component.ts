import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucidePlus } from '@lucide/angular';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { GradeLevel } from '../../../models/grade-level/grade-level.model';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { Enrollment } from '../../../models/enrollment/enrollment.model';
import { Student } from '../../../models/student/student.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { EnrollmentService } from '../../../service/enrollment-service/enrollment.service';
import { StudentService } from '../../../service/student-service/student.service';
import { AcademicWorkspaceStep, WorkspaceContextService } from '../../../shared/workspace-context.service';
import { TuitionWorkspaceComponent } from '../../tuition/tuition-workspace/tuition-workspace.component';
import { EstablishmentNavComponent } from '../../establishment/establishment-nav/establishment-nav.component';
import { AcademicPeriodListComponent } from '../academic-period-list/academic-period-list.component';
import { AcademicYearSettingsComponent } from '../academic-year-settings/academic-year-settings.component';
import { GradeLevelManagerComponent } from '../grade-level-manager/grade-level-manager.component';
import { SchoolClassManagerComponent } from '../school-class-manager/school-class-manager.component';
import { StudentGuardiansComponent } from '../../student/student-guardians/student-guardians.component';
import { SubjectListComponent } from '../../subject/subject-list/subject-list.component';

@Component({
  selector: 'app-academic-year-workspace',
  imports: [FormsModule, RouterLink, TuitionWorkspaceComponent, LucidePlus, EstablishmentNavComponent, AcademicPeriodListComponent, AcademicYearSettingsComponent, GradeLevelManagerComponent, SchoolClassManagerComponent, SubjectListComponent, StudentGuardiansComponent],
  templateUrl: './academic-year-workspace.component.html',
  styleUrl: './academic-year-workspace.component.css'
})
export class AcademicYearWorkspaceComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly studentService = inject(StudentService);
  private readonly enrollmentService = inject(EnrollmentService);
  private readonly workspaceContext = inject(WorkspaceContextService);

  protected readonly establishmentId = signal('');
  protected readonly academicYearId = signal('');
  protected readonly academicYear = signal<AcademicYear | null>(null);
  protected readonly gradeLevels = signal<GradeLevel[]>([]);
  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly students = signal<Student[]>([]);
  protected readonly enrollments = signal<Enrollment[]>([]);
  protected readonly activeStep = this.workspaceContext.activeAcademicStep;
  protected readonly successMessage = signal<string | null>(null);
  protected readonly isLoadingYear = signal(true);
  protected readonly isLoadingLevels = signal(true);
  protected readonly isLoadingClasses = signal(true);
  protected readonly isLoadingStudents = signal(true);
  protected readonly isLoadingEnrollments = signal(true);
  protected readonly isCreatingLevel = signal(false);
  protected readonly isCreatingClass = signal(false);
  protected readonly isCreatingStudent = signal(false);
  protected readonly editingStudentId = signal<string | null>(null);
  protected readonly expandedStudentId = signal<string | null>(null);
  protected readonly isUpdatingStudent = signal(false);
  protected readonly archivingStudentId = signal<string | null>(null);
  protected readonly isCreatingEnrollment = signal(false);
  protected readonly yearError = signal<string | null>(null);
  protected readonly levelError = signal<string | null>(null);
  protected readonly levelLoadError = signal<string | null>(null);
  protected readonly classError = signal<string | null>(null);
  protected readonly classLoadError = signal<string | null>(null);
  protected readonly studentError = signal<string | null>(null);
  protected readonly studentLoadError = signal<string | null>(null);
  protected readonly enrollmentError = signal<string | null>(null);
  protected readonly enrollmentLoadError = signal<string | null>(null);

  protected levelCode = '';
  protected levelName = '';
  protected levelOrder = 1;
  protected classGradeLevelId = '';
  protected classCode = '';
  protected className = '';
  protected studentFirstName = '';
  protected studentLastName = '';
  protected studentEditFirstName = '';
  protected studentEditLastName = '';
  protected enrollmentStudentId = '';
  protected enrollmentClassId = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const establishmentId = params.get('establishmentId');
      const academicYearId = params.get('academicYearId');
      if (!establishmentId || !academicYearId) {
        this.isLoadingYear.set(false);
        this.yearError.set('L’établissement ou l’année scolaire est introuvable.');
        return;
      }

      const routeChanged = establishmentId !== this.establishmentId() || academicYearId !== this.academicYearId();
      if (!routeChanged) {
        return;
      }

      this.establishmentId.set(establishmentId);
      this.academicYearId.set(academicYearId);
      this.academicYear.set(null);
      this.workspaceContext.clearAcademicYear();
      this.successMessage.set(null);
      this.gradeLevels.set([]);
      this.classes.set([]);
      this.students.set([]);
      this.enrollments.set([]);
      this.classGradeLevelId = '';
      this.enrollmentStudentId = '';
      this.enrollmentClassId = '';
      this.loadAcademicYear();
      this.loadGradeLevels();
      this.loadClasses();
      this.loadStudents();
      this.loadEnrollments();
    });
  }

  protected loadAcademicYear(): void {
    this.isLoadingYear.set(true);
    this.yearError.set(null);
    this.academicYearService.getAcademicYear(this.establishmentId(), this.academicYearId()).subscribe({
      next: (year) => {
        this.academicYear.set(year);
        this.workspaceContext.selectAcademicYear(year);
        this.isLoadingYear.set(false);
      },
      error: (error: unknown) => {
        this.yearError.set(error instanceof HttpErrorResponse && error.status === 404
          ? 'Cette année scolaire est absente ou inaccessible pour votre compte.'
          : this.getErrorMessage(error));
        this.isLoadingYear.set(false);
      }
    });
  }

  protected onYearUpdated(year: AcademicYear): void {
    this.academicYear.set(year);
    this.workspaceContext.academicYears.update((years) => years.map((item) => item.id === year.id ? year : item));
    this.workspaceContext.selectAcademicYear(year);
  }

  protected onYearArchived(): void {
    const establishmentId = this.establishmentId();
    this.workspaceContext.academicYears.update((years) => years.filter((item) => item.id !== this.academicYearId()));
    this.workspaceContext.clearAcademicYear();
    void this.router.navigate(['/establishments', establishmentId]);
  }

  protected loadGradeLevels(): void {
    this.isLoadingLevels.set(true);
    this.levelLoadError.set(null);
    this.academicYearService.getGradeLevels(this.establishmentId()).subscribe({
      next: (levels) => {
        this.gradeLevels.set(levels);
        if (!this.classGradeLevelId && levels.length > 0) {
          this.classGradeLevelId = levels[0].id;
        }
        this.isLoadingLevels.set(false);
      },
      error: (error: unknown) => {
        this.levelLoadError.set(this.getErrorMessage(error));
        this.isLoadingLevels.set(false);
      }
    });
  }

  protected loadClasses(): void {
    this.isLoadingClasses.set(true);
    this.classLoadError.set(null);
    this.academicYearService.getClasses(this.establishmentId(), this.academicYearId()).subscribe({
      next: (classes) => {
        this.classes.set(classes);
        this.isLoadingClasses.set(false);
      },
      error: (error: unknown) => {
        this.classLoadError.set(this.getErrorMessage(error));
        this.isLoadingClasses.set(false);
      }
    });
  }

  protected loadStudents(): void {
    this.isLoadingStudents.set(true);
    this.studentLoadError.set(null);
    this.studentService.getStudents(this.establishmentId()).subscribe({
      next: (students) => {
        this.students.set(students);
        this.isLoadingStudents.set(false);
      },
      error: (error: unknown) => {
        this.studentLoadError.set(this.getErrorMessage(error));
        this.isLoadingStudents.set(false);
      }
    });
  }

  protected loadEnrollments(): void {
    this.isLoadingEnrollments.set(true);
    this.enrollmentLoadError.set(null);
    this.enrollmentService.getEnrollments(this.establishmentId(), this.academicYearId()).subscribe({
      next: (enrollments) => {
        this.enrollments.set(enrollments);
        this.isLoadingEnrollments.set(false);
      },
      error: (error: unknown) => {
        this.enrollmentLoadError.set(this.getErrorMessage(error));
        this.isLoadingEnrollments.set(false);
      }
    });
  }

  protected createGradeLevel(): void {
    const code = this.levelCode.trim();
    const name = this.levelName.trim();
    if (!code || !name || this.isCreatingLevel()) {
      return;
    }

    this.levelError.set(null);
    this.successMessage.set(null);
    this.isCreatingLevel.set(true);
    this.academicYearService.createGradeLevel(this.establishmentId(), {
      code,
      name,
      displayOrder: Number(this.levelOrder)
    }).subscribe({
      next: () => {
        this.levelCode = '';
        this.levelName = '';
        this.isCreatingLevel.set(false);
        this.successMessage.set(`Le niveau « ${name} » a été créé.`);
        this.loadGradeLevels();
      },
      error: (error: unknown) => {
        this.levelError.set(this.getErrorMessage(error, 'grade-level'));
        this.isCreatingLevel.set(false);
      }
    });
  }

  protected createClass(): void {
    const code = this.classCode.trim();
    const name = this.className.trim();
    if (!this.classGradeLevelId || !code || !name || this.isCreatingClass()) {
      return;
    }

    this.classError.set(null);
    this.successMessage.set(null);
    this.isCreatingClass.set(true);
    this.academicYearService.createClass(this.establishmentId(), this.academicYearId(), {
      gradeLevelId: this.classGradeLevelId,
      code,
      name
    }).subscribe({
      next: () => {
        this.classCode = '';
        this.className = '';
        this.isCreatingClass.set(false);
        this.successMessage.set(`La classe « ${name} » a été créée.`);
        this.loadClasses();
      },
      error: (error: unknown) => {
        this.classError.set(this.getErrorMessage(error, 'class'));
        this.isCreatingClass.set(false);
      }
    });
  }

  protected createStudent(): void {
    const firstName = this.studentFirstName.trim();
    const lastName = this.studentLastName.trim();
    if (!firstName || !lastName || this.isCreatingStudent()) {
      return;
    }

    this.studentError.set(null);
    this.successMessage.set(null);
    this.isCreatingStudent.set(true);
    this.studentService.createStudent(this.establishmentId(), {
      firstName,
      lastName
    }).subscribe({
      next: (student) => {
        this.studentFirstName = '';
        this.studentLastName = '';
        this.enrollmentStudentId = student.id;
        this.isCreatingStudent.set(false);
        this.successMessage.set(`${student.firstName} ${student.lastName} a été ajouté avec le numéro ${student.studentNumber}.`);
        this.loadStudents();
      },
      error: (error: unknown) => {
        this.studentError.set(this.getErrorMessage(error, 'student'));
        this.isCreatingStudent.set(false);
      }
    });
  }

  protected startEditingStudent(student: Student): void {
    this.editingStudentId.set(student.id);
    this.studentEditFirstName = student.firstName;
    this.studentEditLastName = student.lastName;
    this.studentError.set(null);
  }

  protected toggleStudentDetail(student: Student): void {
    this.expandedStudentId.set(this.expandedStudentId() === student.id ? null : student.id);
  }

  protected cancelStudentEdit(): void {
    this.editingStudentId.set(null);
    this.studentError.set(null);
  }

  protected updateStudent(student: Student): void {
    const firstName = this.studentEditFirstName.trim();
    const lastName = this.studentEditLastName.trim();
    if (!firstName || !lastName || this.isUpdatingStudent()) {
      this.studentError.set('Le prénom et le nom sont obligatoires.');
      return;
    }

    const request: Partial<Pick<Student, 'firstName' | 'lastName'>> = {};
    if (firstName !== student.firstName) request.firstName = firstName;
    if (lastName !== student.lastName) request.lastName = lastName;
    if (Object.keys(request).length === 0) {
      this.cancelStudentEdit();
      return;
    }

    this.studentError.set(null);
    this.successMessage.set(null);
    this.isUpdatingStudent.set(true);
    this.studentService.updateStudent(this.establishmentId(), student.id, request).subscribe({
      next: () => {
        this.isUpdatingStudent.set(false);
        this.editingStudentId.set(null);
        this.successMessage.set(`${firstName} ${lastName} a été modifié.`);
        this.loadStudents();
      },
      error: (error: unknown) => {
        this.studentError.set(this.getErrorMessage(error, 'student'));
        this.isUpdatingStudent.set(false);
      }
    });
  }

  protected archiveStudent(student: Student): void {
    if (this.archivingStudentId() || !window.confirm(`Archiver l’élève ${student.firstName} ${student.lastName} ? Son historique scolaire sera conservé.`)) {
      return;
    }

    this.studentError.set(null);
    this.successMessage.set(null);
    this.archivingStudentId.set(student.id);
    this.studentService.archiveStudent(this.establishmentId(), student.id).subscribe({
      next: () => {
        this.archivingStudentId.set(null);
        if (this.enrollmentStudentId === student.id) this.enrollmentStudentId = '';
        if (this.editingStudentId() === student.id) this.cancelStudentEdit();
        this.successMessage.set(`${student.firstName} ${student.lastName} a été archivé. Son historique scolaire est conservé.`);
        this.loadStudents();
      },
      error: (error: unknown) => {
        this.studentError.set(this.getErrorMessage(error, 'student'));
        this.archivingStudentId.set(null);
      }
    });
  }

  protected createEnrollment(): void {
    const studentId = this.enrollmentStudentId;
    const schoolClassId = this.enrollmentClassId;
    if (!studentId || !schoolClassId || this.hasEnrollment(studentId) || this.isCreatingEnrollment()) {
      return;
    }

    this.enrollmentError.set(null);
    this.successMessage.set(null);
    this.isCreatingEnrollment.set(true);
    this.enrollmentService.createEnrollment(this.establishmentId(), this.academicYearId(), {
      studentId,
      schoolClassId
    }).subscribe({
      next: () => {
        this.isCreatingEnrollment.set(false);
        this.successMessage.set('L’inscription a été enregistrée.');
        this.loadEnrollments();
      },
      error: (error: unknown) => {
        this.enrollmentError.set(this.getErrorMessage(error, 'enrollment'));
        this.isCreatingEnrollment.set(false);
      }
    });
  }

  protected hasEnrollment(studentId: string): boolean {
    return this.enrollments().some((enrollment) => enrollment.studentId === studentId);
  }

  protected selectStep(step: AcademicWorkspaceStep): void {
    this.workspaceContext.setAcademicStep(step);
    this.successMessage.set(null);
  }

  protected canOpenEnrollments(): boolean {
    return this.students().length > 0 && this.classes().length > 0;
  }

  protected levelNameFor(gradeLevelId: string): string {
    return this.gradeLevels().find((level) => level.id === gradeLevelId)?.name ?? 'Niveau';
  }

  protected studentNameFor(studentId: string): string {
    const student = this.students().find((item) => item.id === studentId);
    return student ? `${student.firstName} ${student.lastName}` : 'Élève indisponible';
  }

  protected classNameFor(schoolClassId: string): string {
    return this.classes().find((item) => item.id === schoolClassId)?.name ?? 'Classe indisponible';
  }

  private getErrorMessage(error: unknown, resource?: 'grade-level' | 'class' | 'student' | 'enrollment'): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) {
        return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      }
      if (error.status === 409) {
        if (resource === 'grade-level') return 'Ce code ou ce nom de niveau existe déjà.';
        if (resource === 'class') return 'Ce code ou ce nom de classe existe déjà pour cette année.';
        if (resource === 'enrollment') return 'Cet élève est déjà inscrit pour cette année scolaire.';
      }
      if (error.status === 404 && resource === 'student') return 'Cet élève n’existe plus ou a déjà été archivé.';
    }

    return 'Impossible de charger ou d’enregistrer ces informations. Vérifiez le serveur puis réessayez.';
  }
}