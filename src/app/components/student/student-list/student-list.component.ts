import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Student } from '../../../models/student/student.model';
import { StudentService } from '../../../service/student-service/student.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { StudentGuardiansComponent } from '../student-guardians/student-guardians.component';

@Component({
  selector: 'app-student-list',
  imports: [FormsModule, RouterLink, StudentGuardiansComponent],
  templateUrl: './student-list.component.html',
  styleUrl: './student-list.component.css'
})
export class StudentListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly studentService = inject(StudentService);
  private readonly workspaceContext = inject(WorkspaceContextService);

  protected readonly establishmentId = signal('');
  // Année sélectionnée, uniquement si elle appartient à cet établissement.
  protected readonly academicYearId = computed(() => {
    const context = this.workspaceContext.current();
    return context?.establishmentId === this.establishmentId() ? context.academicYearId : null;
  });
  protected readonly lastCreated = signal<Student | null>(null);
  protected readonly students = signal<Student[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isCreating = signal(false);
  protected readonly isUpdating = signal(false);
  protected readonly archivingId = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected firstName = '';
  protected lastName = '';
  protected editFirstName = '';
  protected editLastName = '';

  ngOnInit(): void {
    this.establishmentId.set(this.route.snapshot.paramMap.get('establishmentId') ?? '');
    this.expandedId.set(this.route.snapshot.queryParamMap.get('studentId'));
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.studentService.getStudents(this.establishmentId()).subscribe({
      next: (students) => {
        this.students.set(students);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(this.errorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  protected create(): void {
    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();
    if (!firstName || !lastName || this.isCreating()) return;

    this.actionError.set(null);
    this.successMessage.set(null);
    this.lastCreated.set(null);
    this.isCreating.set(true);
    this.studentService.createStudent(this.establishmentId(), { firstName, lastName }).subscribe({
      next: (student) => {
        this.firstName = '';
        this.lastName = '';
        this.isCreating.set(false);
        this.lastCreated.set(student);
        this.successMessage.set(`${student.firstName} ${student.lastName} a été ajouté avec le numéro ${student.studentNumber}.`);
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error));
        this.isCreating.set(false);
      }
    });
  }

  protected toggleDetail(student: Student): void {
    this.expandedId.set(this.expandedId() === student.id ? null : student.id);
  }

  protected startEditing(student: Student): void {
    this.editingId.set(student.id);
    this.editFirstName = student.firstName;
    this.editLastName = student.lastName;
    this.actionError.set(null);
  }

  protected cancelEditing(): void {
    this.editingId.set(null);
    this.actionError.set(null);
  }

  protected update(student: Student): void {
    const firstName = this.editFirstName.trim();
    const lastName = this.editLastName.trim();
    if (!firstName || !lastName || this.isUpdating()) {
      this.actionError.set('Le prénom et le nom sont obligatoires.');
      return;
    }

    const request: Partial<Pick<Student, 'firstName' | 'lastName'>> = {};
    if (firstName !== student.firstName) request.firstName = firstName;
    if (lastName !== student.lastName) request.lastName = lastName;
    if (Object.keys(request).length === 0) {
      this.cancelEditing();
      return;
    }

    this.actionError.set(null);
    this.successMessage.set(null);
    this.isUpdating.set(true);
    this.studentService.updateStudent(this.establishmentId(), student.id, request).subscribe({
      next: () => {
        this.isUpdating.set(false);
        this.editingId.set(null);
        this.successMessage.set(`${firstName} ${lastName} a été modifié.`);
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error));
        this.isUpdating.set(false);
      }
    });
  }

  protected archive(student: Student): void {
    if (this.archivingId() || !window.confirm(`Archiver l’élève ${student.firstName} ${student.lastName} ? Son historique scolaire sera conservé.`)) {
      return;
    }

    this.actionError.set(null);
    this.successMessage.set(null);
    this.archivingId.set(student.id);
    this.studentService.archiveStudent(this.establishmentId(), student.id).subscribe({
      next: () => {
        this.archivingId.set(null);
        if (this.editingId() === student.id) this.cancelEditing();
        if (this.expandedId() === student.id) this.expandedId.set(null);
        this.successMessage.set(`${student.firstName} ${student.lastName} a été archivé. Son historique scolaire est conservé.`);
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error));
        this.archivingId.set(null);
      }
    });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'Cet élève n’existe plus ou a déjà été archivé.';
    }
    return 'Impossible de charger ou d’enregistrer ces informations. Vérifiez le serveur puis réessayez.';
  }
}
