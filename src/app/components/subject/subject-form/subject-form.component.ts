import { ToastService } from '../../../service/toast-service/toast.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { Subject } from '../../../models/subject/subject.model';
import { SubjectService } from '../../../service/subject-service/subject.service';
import { apiError } from '../../../shared/api-error';
import { LucideCheck, LucidePlus, LucideTrash2 } from '@lucide/angular';

@Component({
  selector: 'app-subject-form',
  imports: [PermissionDirective, FormsModule, LucideCheck, LucidePlus, LucideTrash2],
  templateUrl: './subject-form.component.html',
  styleUrl: './subject-form.component.css',
})
export class SubjectFormComponent {
  private readonly toast = inject(ToastService);
  protected readonly access = inject(WorkspaceAccessService);
  private readonly api = inject(SubjectService);
  private readonly destroyRef = inject(DestroyRef);
  private nextRow = 0;
  readonly establishmentId = input.required<string>();
  readonly subject = input<Subject | null>(null);
  readonly saved = output<Subject[]>();
  readonly cancelled = output<void>();
  readonly busyChange = output<boolean>();
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected rows: { id: number; name: string; code: string }[] = [];

  constructor() {
    this.toast.connect(this.error, 'error');
    effect(() => {
      this.rows = [{ id: this.nextRow++, name: this.subject()?.name ?? '', code: this.subject()?.code ?? '' }];
      this.error.set(null);
    });
  }

  protected add(): void {
    if (this.saving() || this.subject() || this.rows.length >= 100) return;
    this.rows = [...this.rows, { id: this.nextRow++, name: '', code: '' }];
  }

  protected remove(id: number): void {
    if (this.saving() || this.subject() || this.rows.length <= 1) return;
    this.rows = this.rows.filter((row) => row.id !== id);
  }

  protected save(): void {
    if (!this.access.hasPermission(this.subject() ? 'can_subject_update' : 'can_subject_create', this.establishmentId())) return;
    if (this.saving()) return;
    const subjects = this.rows.map((row) => {
      const code = row.code.trim().toUpperCase();
      return { name: row.name.trim(), ...(code ? { code } : {}) };
    });
    const editing = this.subject();
    if (
      !subjects.length ||
      subjects.length > 100 ||
      subjects.some((item) => !item.name || item.name.length > 100 || (item.code?.length ?? 0) > 40)
    ) {
      this.error.set('Saisissez de 1 à 100 matières, chacune avec un nom de 1 à 100 caractères et un code facultatif de 40 caractères maximum.');
      return;
    }
    if (
      editing &&
      (editing.establishmentId !== this.establishmentId() ||
        !editing.enabled ||
        subjects.length !== 1)
    ) {
      this.error.set('Cette matière est absente ou inaccessible dans cet établissement.');
      return;
    }
    if (editing && !subjects[0].code) {
      this.error.set('Le code est obligatoire pour modifier une matière.');
      return;
    }
    const codes = new Set<string>();
    for (const [index, item] of subjects.entries()) {
      if (item.code && codes.has(item.code)) {
        this.error.set(`Matière ${index + 1} : le code « ${item.code} » est déjà utilisé dans ce lot. Aucun enregistrement n’a été envoyé.`);
        return;
      }
      if (item.code) codes.add(item.code);
    }
    const request = editing
      ? this.api
          .updateSubject(this.establishmentId(), editing.id, { name: subjects[0].name, code: subjects[0].code! })
          .pipe(map((subject) => [subject]))
      : this.api.createSubjects(this.establishmentId(), { subjects });
    this.saving.set(true);
    this.busyChange.emit(true);
    this.error.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (subjects) => {
        this.saving.set(false);
        this.busyChange.emit(false);
        this.saved.emit(subjects);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.busyChange.emit(false);
        this.error.set(
          error instanceof HttpErrorResponse && error.status === 409
            ? editing
              ? 'Ce code de matière existe déjà. Votre saisie est conservée.'
              : 'Un code de matière existe déjà dans l’établissement ou dans le lot. Aucune matière n’a été créée. Votre saisie est conservée.'
            : error instanceof HttpErrorResponse && error.status === 400
              ? 'Vérifiez les noms (1 à 100 caractères) et les codes (40 caractères maximum). Votre saisie est conservée.'
              : apiError(error),
        );
      },
    });
  }
}
