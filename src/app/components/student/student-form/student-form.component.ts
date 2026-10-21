import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Student } from '../../../models/student/student.model';
import { StudentService } from '../../../service/student-service/student.service';
import { isPastOrPresentDate, localDateKey } from '../../../shared/date-range';
import { apiError } from '../../../shared/api-error';

@Component({ selector: 'app-student-form', imports: [PermissionDirective, FormsModule], templateUrl: './student-form.component.html', styleUrl: './student-form.component.css' })
export class StudentFormComponent {
  protected readonly access = inject(WorkspaceAccessService);
  private readonly confirmation = inject(ConfirmationDialogService);
  private readonly api = inject(StudentService);
  private readonly destroyRef = inject(DestroyRef);
  readonly establishmentId = input.required<string>();
  readonly created = output<Student>();
  readonly canceled = output<void>();
  readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected firstName = '';
  protected lastName = '';
  protected dateOfBirth = '';
  protected readonly today = localDateKey;

  canClose(): boolean {
    if (this.saving()) return false;
    if (!(this.firstName.trim() || this.lastName.trim() || this.dateOfBirth)) return true;
    this.confirmation.confirm('Abandonner la saisie de cet élève ?', () => this.canceled.emit());
    return false;
  }

  protected save(): void {
    if (!this.access.hasPermission('can_student_create', this.establishmentId())) return;
    if (this.saving()) return;
    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();
    if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
      this.error.set('Le prénom et le nom sont obligatoires, avec 100 caractères maximum chacun.'); return;
    }
    if (!isPastOrPresentDate(this.dateOfBirth)) { this.error.set('La date de naissance doit être une date valide, aujourd’hui ou dans le passé.'); return; }
    this.saving.set(true); this.error.set(null);
    this.api.createStudent(this.establishmentId(), { firstName, lastName, ...(this.dateOfBirth ? { dateOfBirth: this.dateOfBirth } : {}) }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (student) => { this.saving.set(false); this.firstName = ''; this.lastName = ''; this.dateOfBirth = ''; this.created.emit(student); },
      error: (error: unknown) => { this.saving.set(false); this.error.set(error instanceof HttpErrorResponse && error.status === 404 ? 'Cet établissement est absent ou inaccessible.' : apiError(error)); }
    });
  }
}
