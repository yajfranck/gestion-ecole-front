import { ToastService } from '../../../service/toast-service/toast.service';
import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';

@Component({
  selector: 'app-academic-year-settings',
  imports: [FormModalComponent, PermissionDirective, FormsModule],
  templateUrl: './academic-year-settings.component.html',
  styleUrl: './academic-year-settings.component.css'
})
export class AcademicYearSettingsComponent {
  private readonly toast = inject(ToastService);
  private readonly confirmation = inject(ConfirmationDialogService);
  protected readonly access = inject(WorkspaceAccessService);
  private readonly academicYearService = inject(AcademicYearService);

  readonly establishmentId = input.required<string>();
  readonly year = input.required<AcademicYear>();
  readonly updated = output<AcademicYear>();
  readonly archived = output<void>();

  protected readonly isSaving = signal(false);
  protected readonly isArchiving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected name = '';
  protected startsOn = '';
  protected endsOn = '';

  constructor() {
    this.toast.connect(this.successMessage, 'success');
    this.toast.connect(this.errorMessage, 'error');
    effect(() => {
      const year = this.year();
      this.name = year.name;
      this.startsOn = year.startsOn;
      this.endsOn = year.endsOn;
    });
  }

  protected save(): void {
    if (!this.access.hasPermission('can_academic_year_update', this.establishmentId())) return;
    const name = this.name.trim();
    if (!name || !this.startsOn || !this.endsOn || this.isSaving()) return;

    this.errorMessage.set(null);
    this.successMessage.set(null);
    if (this.startsOn >= this.endsOn) {
      this.errorMessage.set('La date de fin doit être postérieure à la date de début.');
      return;
    }

    const year = this.year();
    const request: Partial<Pick<AcademicYear, 'name' | 'startsOn' | 'endsOn'>> = {};
    if (name !== year.name) request.name = name;
    if (this.startsOn !== year.startsOn) request.startsOn = this.startsOn;
    if (this.endsOn !== year.endsOn) request.endsOn = this.endsOn;
    if (Object.keys(request).length === 0) return;

    this.isSaving.set(true);
    this.academicYearService.updateAcademicYear(this.establishmentId(), year.id, request).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.successMessage.set('L’année scolaire a été modifiée.');
        this.updated.emit(updated);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.getErrorMessage(error, 'update'));
        this.isSaving.set(false);
      }
    });
  }

  protected archive(): void {
    if (!this.access.hasPermission('can_academic_year_delete', this.establishmentId())) return;
    const year = this.year();

    if (this.isArchiving()) return;
    this.confirmation.confirm(`Archiver l’année « ${year.name} » ? Ses données seront conservées.`, () => {

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isArchiving.set(true);
    this.academicYearService.archiveAcademicYear(this.establishmentId(), year.id).subscribe({
      next: () => {
        this.isArchiving.set(false);
        this.archived.emit();
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.getErrorMessage(error, 'archive'));
        this.isArchiving.set(false);
      }
    });

    });
  }

  private getErrorMessage(error: unknown, action: 'update' | 'archive'): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Vérifiez le nom et les dates : elles doivent encore contenir toutes les périodes actives.';
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'Cette année scolaire est absente ou inaccessible pour votre compte.';
      if (error.status === 409) return 'Ce nom d’année est déjà utilisé dans cet établissement.';
    }
    return action === 'update'
      ? 'Impossible de modifier l’année scolaire. Réessayez.'
      : 'Impossible d’archiver l’année scolaire. Réessayez.';
  }
}
