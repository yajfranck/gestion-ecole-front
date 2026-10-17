import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Dashboard, DashboardYear } from '../../models/dashboard/dashboard.model';
import { DashboardService } from '../../service/dashboard-service/dashboard.service';
import { AcademicYearService } from '../../service/academic-year-service/academic-year.service';
import { WorkspaceContextService } from '../../shared/workspace-context.service';
import { apiError } from '../../shared/api-error';

@Component({ selector: 'app-dashboard', imports: [RouterLink, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './dashboard.component.html', styleUrl: './dashboard.component.css' })
export class DashboardComponent implements OnInit {
  private readonly api = inject(DashboardService);
  private readonly academicYears = inject(AcademicYearService);
  private readonly context = inject(WorkspaceContextService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = signal<Dashboard | null>(null);
  protected readonly years = signal<DashboardYear[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly yearsError = signal<string | null>(null);
  protected readonly licenseLabels = { ACTIVE: 'Active', SUSPENDED: 'Suspendue', EXPIRED: 'Expirée', UPCOMING: 'À venir', UNLICENSED: 'Sans licence' };
  protected yearId = '';
  protected date = '';
  private revision = 0;

  ngOnInit(): void { this.load(); }

  protected load(filtered = false): void {
    if (this.isLoading()) return;
    const filters: { academicYearId?: string; date?: string } = filtered && this.data()?.scope === 'ESTABLISHMENT'
      ? { ...(this.yearId ? { academicYearId: this.yearId } : {}), ...(this.date ? { date: this.date } : {}) } : {};
    const version = ++this.revision;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.api.get(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        if (version !== this.revision) return;
        this.data.set(data);
        this.isLoading.set(false);
        if (data.scope === 'PLATFORM') { this.context.clear(); this.years.set([]); return; }
        const school = data.establishment;
        this.yearId = school.academicYear?.id ?? '';
        const today = new Date().toISOString().slice(0, 10);
        this.date = school.attendance?.date ?? filters.date ?? (school.academicYear
          ? [school.academicYear.startsOn, today, school.academicYear.endsOn].sort()[1] : '');
        this.context.current.set({ establishmentId: school.id, establishmentName: school.name,
          academicYearId: school.academicYear?.id ?? null, academicYearName: school.academicYear?.name ?? null });
        this.context.academicYear.set(school.academicYear ? { ...school.academicYear, establishmentId: school.id, enabled: true } : null);
        if (!filtered) this.loadYears();
      },
      error: (error: unknown) => {
        this.data.set(null);
        this.isLoading.set(false);
        this.errorMessage.set(error instanceof HttpErrorResponse && error.status === 403
          ? 'Votre compte ne peut pas consulter ce tableau de bord. Une permission récemment attribuée nécessite de renouveler la session.' : apiError(error));
      }
    });
  }

  protected loadYears(): void {
    const school = this.data()?.establishment;
    if (!school) return;
    this.yearsError.set(null);
    this.academicYears.getAcademicYears(school.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (years) => this.years.set(years.filter((year) => year.enabled && year.establishmentId === school.id)),
      error: () => { this.years.set(school.academicYear ? [school.academicYear] : []); this.yearsError.set('Les autres années sont indisponibles.'); }
    });
  }

  protected selectedYear(): DashboardYear | undefined { return this.years().find((year) => year.id === this.yearId); }
}
