import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucidePlus } from '@lucide/angular';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';

@Component({
  selector: 'app-establishment-settings',
  imports: [FormsModule, RouterLink, LucidePlus],
  templateUrl: './establishment-settings.component.html',
  styleUrl: './establishment-settings.component.css'
})
export class EstablishmentSettingsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly workspaceContext = inject(WorkspaceContextService);

  protected readonly workspace = this.workspaceContext.current;
  protected readonly establishmentId = signal('');
  protected readonly years = signal<AcademicYear[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isCreating = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly createError = signal<string | null>(null);
  protected readonly createSuccess = signal<string | null>(null);
  protected name = '';
  protected startsOn = '';
  protected endsOn = '';

  ngOnInit(): void {
    this.establishmentId.set(this.route.snapshot.paramMap.get('establishmentId') ?? '');
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.academicYearService.getAcademicYears(this.establishmentId()).subscribe({
      next: (years) => {
        this.years.set(years);
        this.workspaceContext.setAcademicYears(years);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(this.getErrorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  protected select(year: AcademicYear): void {
    this.workspaceContext.selectAcademicYear(year);
  }

  protected createAcademicYear(): void {
    const name = this.name.trim();
    if (!name || !this.startsOn || !this.endsOn || this.isCreating()) {
      return;
    }

    this.createError.set(null);
    this.createSuccess.set(null);
    if (this.startsOn >= this.endsOn) {
      this.createError.set('La date de fin doit être postérieure à la date de début.');
      return;
    }

    this.isCreating.set(true);
    this.academicYearService.createAcademicYear(this.establishmentId(), {
      name,
      startsOn: this.startsOn,
      endsOn: this.endsOn
    }).subscribe({
      next: () => {
        this.name = '';
        this.startsOn = '';
        this.endsOn = '';
        this.isCreating.set(false);
        this.createSuccess.set(`L’année scolaire « ${name} » a été créée.`);
        this.load();
      },
      error: (error: unknown) => {
        this.createError.set(this.getErrorMessage(error));
        this.isCreating.set(false);
      }
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
    }
    if (error instanceof HttpErrorResponse && error.status === 409) {
      return 'Cette année scolaire existe déjà dans cet établissement.';
    }
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return 'Vérifiez le nom et les dates de l’année scolaire.';
    }
    return 'Impossible de charger ou d’enregistrer ces informations. Vérifiez le serveur puis réessayez.';
  }
}
