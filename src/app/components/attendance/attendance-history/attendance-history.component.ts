import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { AttendanceHistory } from '../../../models/attendance/attendance.model';
import { AttendanceService } from '../../../service/attendance-service/attendance.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';

@Component({
  selector: 'app-attendance-history',
  imports: [FormsModule, RouterLink],
  templateUrl: './attendance-history.component.html',
  styleUrl: './attendance-history.component.css'
})
export class AttendanceHistoryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly attendance = inject(AttendanceService);
  protected readonly access = inject(WorkspaceAccessService);
  protected readonly year = inject(WorkspaceContextService).academicYear;
  protected readonly history = signal<AttendanceHistory | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly studentId = signal('');
  protected readonly studentName = this.route.snapshot.queryParamMap.get('name') ?? '';
  protected from = '';
  protected to = '';
  private request?: Subscription;

  constructor() {
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.request?.unsubscribe();
      this.loading.set(false);
      this.history.set(null);
      this.error.set(null);
      this.studentId.set(params.get('studentId') ?? '');
      const year = this.year();
      this.from = year?.startsOn ?? '';
      this.to = year ? this.rangeEnd(year.startsOn, year.endsOn) : '';
    });
  }

  protected load(): void {
    if (this.loading()) return;
    const year = this.year();
    if (!year || !this.studentId() || !this.access.hasPermission('can_attendance_read', year.establishmentId)) return;
    this.error.set(null);
    this.history.set(null);
    const days = (Date.parse(this.to) - Date.parse(this.from)) / 86400000 + 1;
    if (!this.from || !this.to || !Number.isFinite(days) || days < 1 || days > 366 || this.from < year.startsOn || this.to > year.endsOn) {
      this.error.set('Choisissez une plage ordonnée de 366 jours maximum, comprise dans l’année scolaire.');
      return;
    }
    this.loading.set(true);
    const studentId = this.studentId();
    this.request = this.attendance.getHistory(year.establishmentId, year.id, studentId, this.from, this.to).subscribe({
      next: (history) => {
        this.loading.set(false);
        if (history.establishmentId !== year.establishmentId || history.academicYearId !== year.id || history.studentId !== studentId || history.from !== this.from || history.to !== this.to) {
          this.error.set('La réponse ne correspond pas au contexte demandé.');
          return;
        }
        this.history.set(history);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.error.set(status === 403 ? 'Accès refusé à cet historique.'
          : status === 400 ? 'Plage de dates invalide ou supérieure à 366 jours.'
          : status === 404 ? 'Élève ou année scolaire introuvable dans cet établissement.'
          : 'Impossible de charger l’historique. Réessayez.');
      }
    });
  }

  private rangeEnd(from: string, end: string): string {
    const maximum = new Date(Date.parse(from) + 365 * 86400000).toISOString().slice(0, 10);
    return end < maximum ? end : maximum;
  }
}