import { ToastService } from '../../../service/toast-service/toast.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { apiError } from '../../../shared/api-error';
import { SchoolClassGridComponent } from '../school-class-grid/school-class-grid.component';

@Component({
  selector: 'app-school-class-form',
  imports: [FormsModule, SchoolClassGridComponent],
  templateUrl: './school-class-form.component.html',
  styleUrl: './school-class-form.component.css'
})
export class SchoolClassFormComponent {
  private readonly toast = inject(ToastService);

  constructor() {
    this.toast.connect(this.error, 'error');
  }

  private readonly access = inject(WorkspaceAccessService);
  private readonly api = inject(AcademicYearService);
  private readonly destroyRef = inject(DestroyRef);
  private nextRowId = 1;

  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();
  readonly saved = output<SchoolClass[]>();
  readonly cancelled = output<void>();
  readonly busyChange = output<boolean>();

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected rows = [{ id: 0, code: '', name: '', series: '' }];

  protected add(): void {
    if (this.saving() || this.rows.length >= 100) return;
    this.rows = [...this.rows, { id: this.nextRowId++, code: '', name: '', series: '' }];
  }

  protected remove(id: number): void {
    if (this.saving() || this.rows.length <= 1) return;
    this.rows = this.rows.filter((row) => row.id !== id);
  }

  protected save(): void {
    if (this.saving() || !this.access.hasPermission('can_school_class_create', this.establishmentId())) return;
    const classes = this.rows.map((row) => ({
      code: row.code.trim().toUpperCase(),
      name: row.name.trim(),
      series: row.series.trim() || null
    }));
    if (!classes.length || classes.length > 100 || classes.some((item) =>
      !item.code || item.code.length > 40 || !item.name || item.name.length > 100 || (item.series?.length ?? 0) > 100
    )) {
      this.error.set('Saisissez de 1 à 100 classes avec un code de 1 à 40 caractères, un nom de 1 à 100 caractères et une série facultative de 100 caractères maximum.');
      return;
    }
    const codes = new Set<string>();
    for (const [index, item] of classes.entries()) {
      if (codes.has(item.code)) {
        this.error.set(`Classe ${index + 1} : le code « ${item.code} » est déjà utilisé dans ce lot.`);
        return;
      }
      codes.add(item.code);
    }

    const request = classes.length === 1
      ? this.api.createClass(this.establishmentId(), this.academicYearId(), classes[0]).pipe(map((item) => [item]))
      : this.api.createClasses(this.establishmentId(), this.academicYearId(), { classes });
    this.saving.set(true);
    this.busyChange.emit(true);
    this.error.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.busyChange.emit(false);
        this.saved.emit(created);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.busyChange.emit(false);
        if (error instanceof HttpErrorResponse && [400, 409].includes(error.status)) {
          const detail = typeof error.error?.detail === 'string' ? error.error.detail : '';
          this.error.set([
            error.status === 409 ? 'Un code de classe existe déjà dans cette année scolaire.' : 'Vérifiez les codes, les noms et les séries des classes.',
            detail,
            'Aucune classe n’a été créée. Votre saisie est conservée.'
          ].filter(Boolean).join(' '));
        } else {
          this.error.set(apiError(error));
        }
      }
    });
  }
}
