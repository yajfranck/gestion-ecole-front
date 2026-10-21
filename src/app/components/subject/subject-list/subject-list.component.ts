import { TableActionDirective } from '../../../shared/table-actions/table-action.directive';
import { TableActionsComponent } from '../../../shared/table-actions/table-actions.component';
import { ToastService } from '../../../service/toast-service/toast.service';
import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { SubjectFormComponent } from '../subject-form/subject-form.component';
import { Subject } from '../../../models/subject/subject.model';
import { SubjectService } from '../../../service/subject-service/subject.service';

@Component({
  selector: 'app-subject-list',
  imports: [TableActionDirective, TableActionsComponent, FormModalComponent, PermissionDirective, SubjectFormComponent],
  templateUrl: './subject-list.component.html',
  styleUrl: './subject-list.component.css'
})
export class SubjectListComponent implements OnInit {
  private readonly toast = inject(ToastService);

  constructor() {
    this.toast.connect(this.successMessage, 'success');
    this.toast.connect(this.formError, 'error');
  }

  private readonly confirmation = inject(ConfirmationDialogService);
  protected readonly access = inject(WorkspaceAccessService);
  private readonly subjectService = inject(SubjectService);

  readonly establishmentId = input.required<string>();

  protected readonly subjects = signal<Subject[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly archivingId = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly editingSubject = computed(() => this.subjects().find(subject => subject.id === this.editingId()) ?? null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    if (!this.access.hasPermission('can_subject_read', this.establishmentId())) { this.isLoading.set(false); return; }
    this.isLoading.set(true);
    this.loadError.set(null);
    this.subjectService.getSubjects(this.establishmentId()).subscribe({
      next: (subjects) => {
        this.subjects.set(subjects);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(this.errorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  protected startEditing(subject: Subject): void {
    if (!this.access.hasPermission('can_subject_update', this.establishmentId())) return;
    this.editingId.set(subject.id);
    this.formError.set(null);
    this.successMessage.set(null);
  }

  protected cancelEditing(): void {
    this.editingId.set(null);
    this.formError.set(null);
  }

  protected onSaved(subjects: Subject[]): void {
    const editing = !!this.editingId();
    this.successMessage.set(editing
      ? `La matière « ${subjects[0].name} » a été modifiée.`
      : subjects.length === 1 ? `La matière « ${subjects[0].name} » a été créée.`
      : `${subjects.length} matières ont été créées.`);
    this.editingId.set(null);
    this.load();
  }

  protected archive(subject: Subject): void {
    if (!this.access.hasPermission('can_subject_delete', this.establishmentId())) return;

    if (this.archivingId()) return;
    this.confirmation.confirm(`Archiver la matière « ${subject.name} » ?`, () => {

    this.archivingId.set(subject.id);
    this.formError.set(null);
    this.successMessage.set(null);
    this.subjectService.archiveSubject(this.establishmentId(), subject.id).subscribe({
      next: () => {
        this.archivingId.set(null);
        if (this.editingId() === subject.id) this.cancelEditing();
        this.successMessage.set(`La matière « ${subject.name} » a été archivée.`);
        this.load();
      },
      error: (error: unknown) => {
        this.formError.set(this.errorMessage(error, true));
        this.archivingId.set(null);
      }
    });

    });
  }

  private errorMessage(error: unknown, archiving = false): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Vérifiez le code et le nom de la matière.';
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'Cette matière est absente ou inaccessible.';
      if (error.status === 409) {
        return archiving
          ? 'Cette matière est utilisée par une classe active : retirez-la d’abord de ces classes.'
          : 'Ce code de matière existe déjà.';
      }
    }
    return 'Impossible de traiter les matières. Vérifiez le serveur puis réessayez.';
  }
}
