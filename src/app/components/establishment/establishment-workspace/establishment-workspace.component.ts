import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucidePlus } from '@lucide/angular';
import { Establishment } from '../../../models/establishment/establishment.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { EstablishmentService } from '../../../service/establishment-service/establishment.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { EstablishmentNavComponent } from '../establishment-nav/establishment-nav.component';

@Component({
  selector: 'app-establishment-workspace',
  imports: [FormsModule, RouterLink, LucidePlus, EstablishmentNavComponent],
  templateUrl: './establishment-workspace.component.html',
  styleUrl: './establishment-workspace.component.css'
})
export class EstablishmentWorkspaceComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly establishmentService = inject(EstablishmentService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly workspaceContext = inject(WorkspaceContextService);

  protected readonly establishmentId = signal('');
  protected readonly establishment = signal<Establishment | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isCreating = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly createError = signal<string | null>(null);
  protected readonly createSuccess = signal<string | null>(null);
  protected name = '';
  protected startsOn = '';
  protected endsOn = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('establishmentId');
    if (!id) {
      this.isLoading.set(false);
      this.errorMessage.set('Établissement introuvable.');
      return;
    }

    this.establishmentId.set(id);
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.establishmentService.getAccessible().subscribe({
      next: (establishments) => {
        const establishment = establishments.find((item) => item.id === this.establishmentId());
        if (!establishment) {
          this.errorMessage.set('Cet établissement est absent ou inaccessible pour votre compte.');
          this.isLoading.set(false);
          return;
        }

        this.establishment.set(establishment);
        this.workspaceContext.selectEstablishment(establishment);
        this.academicYearService.getAcademicYears(establishment.id).subscribe({
          next: (years) => {
            this.workspaceContext.setAcademicYears(years);
            this.workspaceContext.selectCurrentAcademicYear(years);
            this.isLoading.set(false);
          },
          error: (error: unknown) => {
            this.errorMessage.set(this.getErrorMessage(error));
            this.isLoading.set(false);
          }
        });
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.getErrorMessage(error));
        this.isLoading.set(false);
      }
    });
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
