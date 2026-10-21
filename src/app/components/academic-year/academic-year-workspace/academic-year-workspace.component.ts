import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly workspaceContext = inject(WorkspaceContextService);

  protected readonly academicYear = this.workspaceContext.academicYear;
  protected readonly establishmentId = signal('');
  protected readonly academicYearId = signal('');
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
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
    const establishmentId = this.establishmentId();
    const academicYearId = this.academicYearId();
    if (this.workspaceContext.academicYearsLoaded() && this.workspaceContext.current()?.establishmentId === establishmentId) {
      const year = this.workspaceContext.academicYears().find((item) => item.id === academicYearId && item.establishmentId === establishmentId && item.enabled);
      if (year) this.workspaceContext.selectAcademicYear(year);
      else this.errorMessage.set('Cette année scolaire est absente ou inaccessible pour votre compte.');
      this.isLoading.set(false);
      return;
    }
    this.academicYearService.getAcademicYear(establishmentId, academicYearId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (year) => {
        if (establishmentId !== this.establishmentId() || academicYearId !== this.academicYearId()) return;
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
