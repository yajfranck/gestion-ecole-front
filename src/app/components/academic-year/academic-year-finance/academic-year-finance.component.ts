import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { forkJoin, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { Student } from '../../../models/student/student.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { StudentService } from '../../../service/student-service/student.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { TuitionWorkspaceComponent } from '../../tuition/tuition-workspace/tuition-workspace.component';

@Component({
  selector: 'app-academic-year-finance',
  imports: [TuitionWorkspaceComponent],
  templateUrl: './academic-year-finance.component.html',
  styleUrl: './academic-year-finance.component.css'
})
export class AcademicYearFinanceComponent implements OnInit {
  private readonly access = inject(WorkspaceAccessService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly studentService = inject(StudentService);
  private readonly workspaceContext = inject(WorkspaceContextService);
  private readonly route = inject(ActivatedRoute);

  protected readonly initialStudentId = this.route.snapshot.queryParamMap.get('studentId');
  protected readonly year = this.workspaceContext.academicYear;
  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly students = signal<Student[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const year = this.year();
    if (!year) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    forkJoin({
      classes: this.access.hasPermission('can_school_class_read', year.establishmentId)
        ? this.academicYearService.getClasses(year.establishmentId, year.id) : of([]),
      students: this.access.hasPermission('can_student_read', year.establishmentId)
        ? this.studentService.getStudents(year.establishmentId) : of([])
    }).subscribe({
      next: ({ classes, students }) => { this.classes.set(classes); this.students.set(students); this.isLoading.set(false); },
      error: (error: unknown) => this.fail(error)
    });
  }

  private fail(error: unknown): void {
    this.errorMessage.set(error instanceof HttpErrorResponse && error.status === 403
      ? 'Votre compte ne dispose pas de l’autorisation nécessaire pour consulter ces informations.'
      : 'Impossible de charger l’espace financier. Vérifiez le serveur puis réessayez.');
    this.isLoading.set(false);
  }
}
