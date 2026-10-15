import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AcademicYearService } from '../../service/academic-year-service/academic-year.service';
import { Establishment } from '../../models/establishment/establishment.model';
import { EstablishmentService } from '../../service/establishment-service/establishment.service';
import { WorkspaceContextService } from '../../shared/workspace-context.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private readonly establishmentService = inject(EstablishmentService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly workspaceContext = inject(WorkspaceContextService);

  protected readonly establishments = signal<Establishment[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly dateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date());

  ngOnInit(): void {
    this.loadEstablishments();
  }

  protected loadEstablishments(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.establishmentService.getAccessible().subscribe({
      next: (establishments) => {
        this.establishments.set(establishments);
        this.isLoading.set(false);
        this.initializeWorkspace(establishments);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.getErrorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  private initializeWorkspace(establishments: Establishment[]): void {
    const enabledEstablishments = establishments.filter((establishment) => establishment.enabled);
    const previousContext = this.workspaceContext.current();
    const establishment = previousContext
      ? enabledEstablishments.find((item) => item.id === previousContext.establishmentId)
      : enabledEstablishments.length === 1 ? enabledEstablishments[0] : undefined;

    if (!establishment) {
      if (previousContext) this.workspaceContext.clear();
      return;
    }

    this.workspaceContext.selectEstablishment(establishment);
    this.academicYearService.getAcademicYears(establishment.id).subscribe({
      next: (years) => this.workspaceContext.selectCurrentAcademicYear(years),
      error: () => this.workspaceContext.clearAcademicYear()
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return 'Votre compte ne dispose pas de l’autorisation nécessaire pour consulter les établissements.';
    }

    return 'Les informations des établissements sont momentanément indisponibles.';
  }
}