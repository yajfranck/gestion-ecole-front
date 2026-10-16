import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { Establishment } from '../../../models/establishment/establishment.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { EstablishmentService } from '../../../service/establishment-service/establishment.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';

@Component({
  selector: 'app-establishment-workspace',
  imports: [RouterLink, RouterOutlet],
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
  protected readonly establishmentName = computed(() => {
    const context = this.workspaceContext.current();
    return context?.establishmentId === this.establishmentId() ? context.establishmentName : this.establishment()?.name;
  });
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('establishmentId');
      if (!id) {
        this.isLoading.set(false);
        this.errorMessage.set('Établissement introuvable.');
        return;
      }

      if (id === this.establishmentId()) {
        return;
      }

      this.establishmentId.set(id);
      this.load();
    });
  }

  protected load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.establishment.set(null);
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
            this.restoreYearContext(years);
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

  private restoreYearContext(years: AcademicYear[]): void {
    const previousYearId = this.workspaceContext.current()?.academicYearId;
    const previousYear = years.find((year) => year.id === previousYearId && year.enabled);
    if (previousYear) {
      this.workspaceContext.setAcademicYears(years);
      this.workspaceContext.selectAcademicYear(previousYear);
    } else {
      this.workspaceContext.selectCurrentAcademicYear(years);
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return 'Votre compte ne dispose pas de l’autorisation nécessaire pour consulter cet établissement.';
    }
    return 'Impossible de charger l’établissement. Vérifiez le serveur puis réessayez.';
  }
}
