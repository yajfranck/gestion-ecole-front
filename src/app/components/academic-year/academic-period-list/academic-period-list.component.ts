import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AcademicPeriod } from '../../../models/academic-period/academic-period.model';
import { AcademicPeriodService } from '../../../service/academic-period-service/academic-period.service';

@Component({
  selector: 'app-academic-period-list',
  imports: [FormsModule],
  templateUrl: './academic-period-list.component.html',
  styleUrl: './academic-period-list.component.css'
})
export class AcademicPeriodListComponent implements OnInit {
  private readonly periodService = inject(AcademicPeriodService);

  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();
  readonly yearStartsOn = input('');
  readonly yearEndsOn = input('');

  protected readonly periods = signal<AcademicPeriod[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly archivingId = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected name = '';
  protected startsOn = '';
  protected endsOn = '';

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.periodService.getPeriods(this.establishmentId(), this.academicYearId()).subscribe({
      next: (periods) => {
        this.periods.set(periods);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(this.errorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  protected startEditing(period: AcademicPeriod): void {
    this.editingId.set(period.id);
    this.name = period.name;
    this.startsOn = period.startsOn;
    this.endsOn = period.endsOn;
    this.formError.set(null);
    this.successMessage.set(null);
  }

  protected cancelEditing(): void {
    this.editingId.set(null);
    this.resetForm();
    this.formError.set(null);
  }

  protected save(): void {
    const name = this.name.trim();
    if (!name || !this.startsOn || !this.endsOn || this.isSaving()) return;

    this.formError.set(null);
    this.successMessage.set(null);
    if (this.startsOn >= this.endsOn) {
      this.formError.set('La date de fin doit être postérieure à la date de début.');
      return;
    }

    const request = { name, startsOn: this.startsOn, endsOn: this.endsOn };
    const editingId = this.editingId();
    const call = editingId
      ? this.periodService.updatePeriod(this.establishmentId(), this.academicYearId(), editingId, request)
      : this.periodService.createPeriod(this.establishmentId(), this.academicYearId(), request);

    this.isSaving.set(true);
    call.subscribe({
      next: () => {
        this.successMessage.set(editingId ? `La période « ${name} » a été modifiée.` : `La période « ${name} » a été créée.`);
        this.editingId.set(null);
        this.resetForm();
        this.isSaving.set(false);
        this.load();
      },
      error: (error: unknown) => {
        this.formError.set(this.errorMessage(error));
        this.isSaving.set(false);
      }
    });
  }

  protected archive(period: AcademicPeriod): void {
    if (this.archivingId() || !window.confirm(`Archiver la période « ${period.name} » ? L’historique sera conservé.`)) return;

    this.archivingId.set(period.id);
    this.formError.set(null);
    this.successMessage.set(null);
    this.periodService.archivePeriod(this.establishmentId(), this.academicYearId(), period.id).subscribe({
      next: () => {
        this.archivingId.set(null);
        if (this.editingId() === period.id) this.cancelEditing();
        this.successMessage.set(`La période « ${period.name} » a été archivée.`);
        this.load();
      },
      error: (error: unknown) => {
        this.formError.set(this.errorMessage(error));
        this.archivingId.set(null);
      }
    });
  }

  private resetForm(): void {
    this.name = '';
    this.startsOn = '';
    this.endsOn = '';
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Vérifiez le nom et les dates : elles doivent rester dans l’année scolaire.';
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'Cette période ou cette année scolaire est absente ou inaccessible.';
      if (error.status === 409) return 'Cette période chevauche une autre période ou son nom est déjà utilisé dans l’année.';
    }
    return 'Impossible de traiter les périodes. Vérifiez le serveur puis réessayez.';
  }
}
