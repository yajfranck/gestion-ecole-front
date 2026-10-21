import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { effect, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { apiError } from '../../../shared/api-error';
import { localDateKey } from '../../../shared/date-range';

@Component({ selector: 'app-academic-year-form', imports: [PermissionDirective, FormsModule], templateUrl: './academic-year-form.component.html', styleUrl: './academic-year-form.component.css' })
export class AcademicYearFormComponent {
  readonly busyChange = output<boolean>();
  private readonly reportBusy = effect(() => this.busyChange.emit(this.saving()));
  protected readonly access = inject(WorkspaceAccessService);
  private readonly api = inject(AcademicYearService);
  private readonly destroyRef = inject(DestroyRef);
  readonly establishmentId = input.required<string>();
  readonly submitLabel = input('Créer l’année');
  readonly requireCurrentYear = input(false);
  readonly created = output<AcademicYear>();
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected name = '';
  protected startsOn = '';
  protected endsOn = '';

  protected save(): void {
    if (!this.access.hasPermission('can_academic_year_create', this.establishmentId())) return;
    if (this.saving()) return;
    const name = this.name.trim();
    if (!name || name.length > 100 || !this.startsOn || !this.endsOn || this.startsOn >= this.endsOn) {
      this.error.set('Saisissez un nom de 100 caractères maximum et une date de fin postérieure au début.'); return;
    }
    const today = localDateKey();
    if (this.requireCurrentYear() && (this.startsOn > today || this.endsOn < today)) {
      this.error.set('Les dates de l’année courante doivent inclure la date d’aujourd’hui.'); return;
    }
    this.saving.set(true); this.error.set(null);
    this.api.createAcademicYear(this.establishmentId(), { name, startsOn: this.startsOn, endsOn: this.endsOn }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (year) => { this.saving.set(false); this.name = ''; this.startsOn = ''; this.endsOn = ''; this.created.emit(year); },
      error: (error: unknown) => { this.saving.set(false); this.error.set(error instanceof HttpErrorResponse && error.status === 409 ? 'Cette année existe déjà. Vérifiez les années de l’établissement avant de réessayer.' : apiError(error)); }
    });
  }
}
