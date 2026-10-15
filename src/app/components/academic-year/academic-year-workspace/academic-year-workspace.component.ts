import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';

@Component({
  selector: 'app-academic-year-workspace',
  imports: [RouterOutlet],
  templateUrl: './academic-year-workspace.component.html',
  styleUrl: './academic-year-workspace.component.css'
})
export class AcademicYearWorkspaceComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly workspaceContext = inject(WorkspaceContextService);

  protected readonly academicYear = this.workspaceContext.academicYear;
  protected readonly establishmentId = signal('');
  protected readonly academicYearId = signal('');
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const establishmentId = params.get('establishmentId');
      const academicYearId = params.get('academicYearId');
      if (!establishmentId || !academicYearId) {
        this.isLoading.set(false);
        this.errorMessage.set('L’établissement ou l’année scolaire est introuvable.');
        return;
      }

      if (establishmentId === this.establishmentId() && academicYearId === this.academicYearId()) {
        return;
      }

      this.establishmentId.set(establishmentId);
      this.academicYearId.set(academicYearId);
      this.load();
    });
  }

  protected load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.workspaceContext.clearAcademicYear();
    this.academicYearService.getAcademicYear(this.establishmentId(), this.academicYearId()).subscribe({
      next: (year) => {
        this.workspaceContext.selectAcademicYear(year);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(error instanceof HttpErrorResponse && error.status === 404
          ? 'Cette année scolaire est absente ou inaccessible pour votre compte.'
          : 'Impossible de charger l’année scolaire. Vérifiez le serveur puis réessayez.');
        this.isLoading.set(false);
      }
    });
  }
}
