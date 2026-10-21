import { Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { concatMap, forkJoin, from, of, tap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { LucidePlus, LucideTrash2 } from '@lucide/angular';
import { FormRowsComponent } from '../../../shared/form-rows/form-rows.component';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { SchoolClassSubject, Subject } from '../../../models/subject/subject.model';
import { SubjectService } from '../../../service/subject-service/subject.service';
import { ToastService } from '../../../service/toast-service/toast.service';
import { apiError } from '../../../shared/api-error';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';

@Component({
  selector: 'app-class-subject-manager',
  imports: [RouterLink, FormsModule, FormRowsComponent, LucidePlus, LucideTrash2],
  templateUrl: './class-subject-manager.component.html',
  styleUrl: './class-subject-manager.component.css'
})
export class ClassSubjectManagerComponent implements OnInit {
  protected readonly access = inject(WorkspaceAccessService);
  private readonly api = inject(SubjectService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(ConfirmationDialogService);
  private readonly toast = inject(ToastService);
  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();
  readonly schoolClassId = input.required<string>();
  readonly canceled = output<void>();
  readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly assignments = signal<SchoolClassSubject[]>([]);
  protected readonly assignedSubjects = computed(() => {
    const subjects = new Map(this.subjects().map(subject => [subject.id, subject]));
    return this.assignments().map(assignment => ({ assignment, subject: subjects.get(assignment.subjectId) }));
  });
  protected readonly availableSubjects = computed(() => {
    const assigned = new Set(this.assignments().map(assignment => assignment.subjectId));
    return this.subjects().filter(subject => !assigned.has(subject.id));
  });

  protected rows: { key: number; subjectId: string }[] = [];
  private nextKey = 0;

  ngOnInit(): void { this.load(); }

  protected load(): void {
    if (this.busy() || !this.access.hasPermission('can_class_subject_read', this.establishmentId())) { this.loading.set(false); return; }
    this.loading.set(true); this.loadError.set(null); this.error.set(null);
    forkJoin({
      subjects: this.access.hasPermission('can_subject_read', this.establishmentId()) ? this.api.getSubjects(this.establishmentId()) : of([]),
      assignments: this.api.getClassSubjects(this.establishmentId(), this.academicYearId(), this.schoolClassId())
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ subjects, assignments }) => {
        this.subjects.set(subjects.filter(subject => subject.enabled && subject.establishmentId === this.establishmentId()));
        this.assignments.set(assignments.filter(assignment => assignment.enabled && assignment.establishmentId === this.establishmentId() && assignment.schoolClassId === this.schoolClassId()));
        this.loading.set(false);
        if (!this.assignments().length && !this.rows.length) this.add();
      },
      error: (error: unknown) => { this.loadError.set(apiError(error)); this.loading.set(false); }
    });
  }

  protected canAdd(): boolean {
    return this.access.hasPermission('can_class_subject_assign', this.establishmentId())
      && this.availableSubjects().length > this.rows.length;
  }

  protected add(): void {
    if (this.busy() || !this.canAdd()) return;
    this.rows = [...this.rows, { key: this.nextKey++, subjectId: '' }];
  }

  protected remove(key: number): void {
    if (!this.busy()) this.rows = this.rows.filter(row => row.key !== key);
  }

  protected options(key: number): Subject[] {
    const selected = new Set(this.rows.filter(row => row.key !== key).map(row => row.subjectId));
    return this.availableSubjects().filter(subject => !selected.has(subject.id));
  }

  protected save(): void {
    if (this.busy() || !this.rows.length || !this.access.hasPermission('can_class_subject_assign', this.establishmentId())) return;
    const available = new Set(this.availableSubjects().map(subject => subject.id));
    if (this.rows.some(row => !available.has(row.subjectId)) || new Set(this.rows.map(row => row.subjectId)).size !== this.rows.length) {
      this.error.set('Choisissez une matière différente sur chaque ligne.'); return;
    }
    this.busy.set(true); this.error.set(null);
    from([...this.rows]).pipe(
      concatMap(row => this.api.assignSubject(this.establishmentId(), this.academicYearId(), this.schoolClassId(), row.subjectId).pipe(tap(assignment => {
        this.assignments.update(assignments => [...assignments, assignment]);
        this.rows = this.rows.filter(item => item.key !== row.key);
      }))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      complete: () => { if (!this.destroyRef.destroyed) { this.busy.set(false); this.toast.success('Les matières ont été affectées à la classe.'); } },
      error: (error: unknown) => { this.busy.set(false); this.error.set(apiError(error)); }
    });
  }

  protected unassign(assignment: SchoolClassSubject): void {
    if (this.busy() || !this.access.hasPermission('can_class_subject_unassign', this.establishmentId())) return;
    const name = this.subjects().find(subject => subject.id === assignment.subjectId)?.name ?? 'cette matière';
    this.confirmation.confirm(`Retirer « ${name} » des matières de cette classe ?`, () => {
      if (this.destroyRef.destroyed || this.busy() || !this.access.hasPermission('can_class_subject_unassign', this.establishmentId())) return;
      this.busy.set(true); this.error.set(null);
      this.api.unassignSubject(this.establishmentId(), this.academicYearId(), this.schoolClassId(), assignment.subjectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.assignments.update(assignments => assignments.filter(item => item.id !== assignment.id));
          this.busy.set(false); this.toast.success('La matière a été retirée de la classe.');
        },
        error: (error: unknown) => { this.busy.set(false); this.error.set(apiError(error)); }
      });
    }, 'Retirer une matière');
  }
}
