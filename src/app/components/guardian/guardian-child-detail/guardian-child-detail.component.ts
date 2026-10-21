import { TableActionDirective } from '../../../shared/table-actions/table-action.directive';
import { TableActionsComponent } from '../../../shared/table-actions/table-actions.component';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, of, switchMap } from 'rxjs';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { GuardianService } from '../../../service/guardian-service/guardian.service';
import { GuardianPortalService } from '../../../service/guardian-service/guardian-portal.service';
import { GuardianChild } from '../../../models/guardian/guardian.model';
import { GuardianAttendanceHistory, GuardianChildSummary, GuardianPayment, GuardianTuitionFee } from '../../../models/guardian/guardian-portal.model';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { apiError } from '../../../shared/api-error';
import { validDateRange } from '../../../shared/date-range';

@Component({
  selector: 'app-guardian-child-detail',
  imports: [TableActionDirective, TableActionsComponent, FormsModule, RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './guardian-child-detail.component.html',
  styleUrl: './guardian-child-detail.component.css'
})
export class GuardianChildDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly guardians = inject(GuardianService);
  private readonly api = inject(GuardianPortalService);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly context = inject(WorkspaceContextService);
  private readonly params = toSignal(combineLatest([this.route.paramMap, this.route.queryParamMap]));
  private readonly reloadVersion = signal(0);
  protected readonly years = signal<AcademicYear[]>([]);
  protected readonly yearsError = signal<string | null>(null);
  protected readonly selectedYearId = computed(() => {
    const id = this.params()?.[1].get('academicYearId') ?? '';
    return this.years().some((year) => year.id === id) ? id : null;
  });
  protected readonly child = signal<GuardianChild | null>(null);
  protected readonly summary = signal<GuardianChildSummary | null>(null);
  protected readonly fees = signal<GuardianTuitionFee[] | null>(null);
  protected readonly payments = signal<GuardianPayment[] | null>(null);
  protected readonly attendance = signal<GuardianAttendanceHistory | null>(null);
  protected readonly tab = signal<'summary' | 'fees' | 'attendance'>('summary');
  protected readonly loading = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly detailError = signal<string | null>(null);
  protected readonly selectedFee = signal<GuardianTuitionFee | null>(null);
  protected yearId = '';
  protected from = '';
  protected to = '';
  private requestVersion = 0;

  constructor() {
    
    effect((onCleanup) => {
      this.reloadVersion();
      const params = this.params();
      if (!params) return;
      const studentId = params[0].get('studentId') ?? '';
      const yearId = params[1].get('academicYearId') ?? '';
      this.yearId = yearId;
      this.requestVersion++;
      this.child.set(null);
      this.years.set([]);
      this.yearsError.set(null);
      this.summary.set(null);
      this.fees.set(null);
      this.payments.set(null);
      this.attendance.set(null);
      this.selectedFee.set(null);
      this.tab.set('summary');
      this.error.set(null);
      this.detailError.set(null);
      this.detailLoading.set(false);
      this.from = new Date().toISOString().slice(0, 10);
      this.to = this.from;
      this.loading.set(true);
      const subscription = this.guardians.getMyChildren().pipe(switchMap((children) => {
        const child = children.find((item) => item.id === studentId);
        this.child.set(child ?? null);
        if (!child) { this.error.set('Cet enfant n’est pas accessible depuis votre compte.'); return of(null); }
        return this.academicYearService.getAcademicYears(child.establishmentId).pipe(
          catchError((error: unknown) => {
            this.yearsError.set(apiError(error));
            return of(null);
          }),
          switchMap((years) => {
            if (!years) return of(null);
            const availableYears = years.filter((year) => year.enabled && year.establishmentId === child.establishmentId);
            this.years.set(availableYears);
            if (!yearId) return of(null);
            if (!availableYears.some((year) => year.id === yearId)) {
              this.yearId = '';
              this.error.set('Cette année scolaire n’est pas disponible pour cet établissement.');
              return of(null);
            }
            return this.api.summary(child.establishmentId, studentId, yearId);
          })
        );
      })).subscribe({
        next: (summary) => {
          if (summary && (summary.studentId !== studentId || summary.academicYearId !== yearId || summary.establishmentId !== this.child()?.establishmentId)) {
            this.error.set('Le contexte retourné ne correspond pas à cet enfant.');
          } else {
            this.summary.set(summary);
            if (summary) {
              this.from = summary.startsOn;
              const maximum = new Date(Date.parse(summary.startsOn) + 365 * 86400000).toISOString().slice(0, 10);
              this.to = summary.endsOn < maximum ? summary.endsOn : maximum;
            }
          }
          this.loading.set(false);
        },
        error: (error) => { this.error.set(apiError(error)); this.loading.set(false); }
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected selectYear(): void {
    if (this.loading()) return;
    if (!this.years().some((year) => year.id === this.yearId)) {
      this.error.set('Sélectionnez une année scolaire disponible dans la liste.');
      return;
    }
    void this.router.navigate([], { relativeTo: this.route, queryParams: { academicYearId: this.yearId } });
  }

  protected retryYears(): void {
    this.reloadVersion.update((version) => version + 1);
  }

  protected open(tab: 'summary' | 'fees' | 'attendance'): void {
    this.tab.set(tab);
    this.detailError.set(null);
    if (tab === 'fees' && this.fees() === null) this.loadFees();
    if (tab === 'attendance' && this.attendance() === null) this.loadAttendance();
  }

  protected loadFees(): void {
    const summary = this.requestContext();
    if (!summary) return;
    this.detailLoading.set(true);
    const version = ++this.requestVersion;
    this.api.fees(summary.establishmentId, summary.studentId, summary.academicYearId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (fees) => { if (version !== this.requestVersion) return; this.fees.set(fees); this.detailLoading.set(false); },
      error: (error) => this.fail(error, version)
    });
  }

  protected loadPayments(fee = this.selectedFee()): void {
    const summary = this.requestContext();
    if (!summary || !fee || !this.checkDates()) return;
    this.selectedFee.set(fee);
    this.payments.set(null);
    this.detailLoading.set(true);
    const version = ++this.requestVersion;
    this.api.payments(summary.establishmentId, summary.studentId, summary.academicYearId, fee.chargeId, this.from, this.to).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (payments) => { if (version !== this.requestVersion) return; this.payments.set(payments); this.detailLoading.set(false); },
      error: (error) => this.fail(error, version)
    });
  }

  protected loadAttendance(): void {
    const summary = this.requestContext();
    if (!summary || !this.checkDates()) return;
    this.attendance.set(null);
    this.detailLoading.set(true);
    const version = ++this.requestVersion;
    this.api.attendance(summary.establishmentId, summary.studentId, summary.academicYearId, this.from, this.to).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (history) => { if (version !== this.requestVersion) return; this.attendance.set(history); this.detailLoading.set(false); },
      error: (error) => this.fail(error, version)
    });
  }

  private checkDates(): boolean {
    this.detailError.set(null);
    if (validDateRange(this.from, this.to)) return true;
    this.detailError.set('Choisissez une période ordonnée de 366 jours maximum.');
    return false;
  }

  private requestContext(): { establishmentId: string; studentId: string; academicYearId: string } | null {
    const child = this.child();
    const year = this.selectedYearId();
    return child && year ? { establishmentId: child.establishmentId, studentId: child.id, academicYearId: year } : null;
  }

  private fail(error: unknown, version: number): void {
    if (version !== this.requestVersion) return;
    this.detailError.set(apiError(error));
    this.detailLoading.set(false);
  }
}
