import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { TimetableNonWorkingDay } from '../../../models/timetable/timetable.model';
import { TimetableService } from '../../../service/timetable-service/timetable.service';
import { dateInYear, timetableError } from '../../../shared/timetable';

@Component({
  selector: 'app-timetable-days-form',
  imports: [FormsModule],
  templateUrl: './timetable-days-form.component.html',
  styleUrl: './timetable-days-form.component.css',
})
export class TimetableDaysFormComponent implements OnInit {
  private readonly api = inject(TimetableService);
  private readonly destroyRef = inject(DestroyRef);
  readonly year = input.required<AcademicYear>();
  readonly allowed = input(false);
  readonly saved = output<TimetableNonWorkingDay[]>();
  readonly cancelled = output<void>();
  readonly busyChange = output<boolean>();
  readonly dirtyChange = output<boolean>();
  protected readonly loading = signal(true);
  protected readonly loaded = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected days: TimetableNonWorkingDay[] = [];
  ngOnInit(): void {
    this.load();
  }
  protected load(): void {
    this.loading.set(true);
    this.loaded.set(false);
    this.error.set(null);
    const year = this.year();
    this.api
      .nonWorkingDays(year.establishmentId, year.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (days) => {
          this.days = days.map((day) => ({ ...day }));
          this.loading.set(false);
          this.loaded.set(true);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(timetableError(error));
        },
      });
  }
  protected add(): void {
    if (this.saving() || !this.allowed() || !this.loaded() || this.days.length >= 730) return;
    this.days = [...this.days, { date: '', name: '' }];
    this.dirtyChange.emit(true);
  }
  protected remove(index: number): void {
    if (this.saving() || !this.allowed()) return;
    this.days = this.days.filter((_, i) => i !== index);
    this.dirtyChange.emit(true);
  }
  protected save(): void {
    if (this.saving() || !this.allowed() || !this.loaded()) return;
    const days = this.days.map((day) => ({ date: day.date, name: day.name.trim() }));
    if (
      days.length > 730 ||
      new Set(days.map((day) => day.date)).size !== days.length ||
      days.some((day) => !dateInYear(day.date, this.year()) || !day.name || day.name.length > 100)
    ) {
      this.error.set(
        'Chaque jour doit avoir une date unique dans l’année et un libellé de 1 à 100 caractères (730 jours maximum).',
      );
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.busyChange.emit(true);
    this.api
      .replaceNonWorkingDays(this.year().establishmentId, this.year().id, days)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.busyChange.emit(false);
          this.dirtyChange.emit(false);
          this.saved.emit(saved);
        },
        error: (error: unknown) => {
          this.error.set(timetableError(error));
          this.saving.set(false);
          this.busyChange.emit(false);
        },
      });
  }
}
