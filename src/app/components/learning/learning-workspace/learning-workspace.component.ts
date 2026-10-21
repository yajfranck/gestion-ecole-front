import { ToastService } from '../../../service/toast-service/toast.service';
import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Component, computed, DestroyRef, effect, HostListener, inject, OnDestroy, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideDownload } from '@lucide/angular';
import { forkJoin } from 'rxjs';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { LicenseAccessService } from '../../../core/license-access.service';
import { PendingChangesService } from '../../../shared/pending-changes.service';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { GuardianService } from '../../../service/guardian-service/guardian.service';
import { LearningService, learningFileError } from '../../../service/learning-service/learning.service';
import { LearningAttachment, LearningContent, LearningPage, LearningRequest, LearningScope, LearningType } from '../../../models/learning/learning.model';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { Subject } from '../../../models/subject/subject.model';
import { SubjectService } from '../../../service/subject-service/subject.service';
import { apiError } from '../../../shared/api-error';

@Component({
  selector: 'app-learning-workspace',
  imports: [FormModalComponent, FormsModule, DatePipe, RouterLink, LucideDownload],
  templateUrl: './learning-workspace.component.html',
  styleUrl: './learning-workspace.component.css'
})
export class LearningWorkspaceComponent implements OnDestroy {
  private readonly toast = inject(ToastService);
  private readonly confirmation = inject(ConfirmationDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(LearningService);
  private readonly years = inject(AcademicYearService);
  private readonly subjectService = inject(SubjectService);
  private readonly guardians = inject(GuardianService);
  private readonly context = inject(WorkspaceContextService);
  private readonly access = inject(WorkspaceAccessService);
  protected readonly license = inject(LicenseAccessService);
  protected readonly pending = inject(PendingChangesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly params = toSignal(this.route.paramMap);
  protected readonly parent = computed(() => !!this.params()?.get('studentId'));
  protected readonly scope = signal<LearningScope | null>(null);
  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly classId = signal('');
  protected readonly subjects = signal<Subject[]>([]);
  protected readonly subjectsLoading = signal(false);
  protected readonly subjectsError = signal<string | null>(null);
  protected readonly page = signal<LearningPage | null>(null);
  protected readonly selected = signal<LearningContent | null>(null);
  protected readonly attachments = signal<LearningAttachment[]>([]);
  protected readonly files = signal<File[]>([]);
  protected readonly loading = signal(false);
  protected readonly detailsLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly uploadProgress = signal<number | null>(null);
  protected readonly downloadId = signal<string | null>(null);
  protected readonly statuses = { DRAFT: 'Brouillon', PUBLISHED: 'Publié', ARCHIVED: 'Archivé' };
  protected readonly types = { LESSON: 'Cours', ASSIGNMENT: 'Devoir' };
  protected type: LearningType | '' = '';
  protected draft: LearningRequest = this.emptyDraft();
  private revision = 0;
  private detailsRevision = 0;
  private subjectsRevision = 0;

  constructor() {
    this.toast.connect(this.success, 'success');
    this.toast.connect(this.error, 'error');
    effect((onCleanup) => {
      const params = this.params();
      const year = this.context.academicYear();
      const authorities = this.access.authorities();
      if (!params) return;
      const studentId = params.get('studentId');
      const yearId = params.get('academicYearId');
      untracked(() => this.reset());
      if (studentId && yearId) {

        if (!authorities.includes('can_guardian_read_children')) { this.error.set('Accès parent non autorisé.'); return; }
        this.loading.set(true);
        const subscription = this.guardians.getMyChildren().subscribe({
          next: (children) => {
            const child = children.find((item) => item.id === studentId);
            if (!child) { this.error.set('Cet enfant n’est pas accessible depuis votre compte.'); this.loading.set(false); return; }
            this.scope.set({ establishmentId: child.establishmentId, studentId, academicYearId: yearId });
            this.load();
          },
          error: (error) => { this.error.set(apiError(error)); this.loading.set(false); }
        });
        onCleanup(() => subscription.unsubscribe());
        return;
      }
      const establishmentId = params.get('establishmentId');
      if (!year || year.id !== yearId || year.establishmentId !== establishmentId) return;
      if (!this.access.hasPermission('can_learning_content_read', establishmentId!)) {
        this.error.set('Consultation des cours non autorisée pour votre compte.'); return;
      }
      this.loading.set(true);
      const subscription = this.years.getClasses(year.establishmentId, year.id).subscribe({
        next: (classes) => {
          this.classes.set(classes.filter((item) => item.establishmentId === year.establishmentId && item.academicYearId === year.id && item.enabled));
          this.loading.set(false);
          const requested = this.route.snapshot.queryParamMap.get('classId');
          if (requested && this.classes().some((item) => item.id === requested)) this.selectClass(requested);
        },
        error: (error) => { this.error.set(apiError(error)); this.loading.set(false); }
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  ngOnDestroy(): void {
    this.pending.dirty.set(false);
    this.pending.saving.set(false);
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.pending.dirty() || this.pending.saving()) { event.preventDefault(); event.returnValue = ''; }
  }

  protected allowed(action: 'create' | 'update' | 'publish' | 'archive'): boolean {
    const scope = this.scope();
    return !!scope && !('studentId' in scope) && (!['create', 'update'].includes(action) || this.access.hasAllPermissions(['can_subject_read', 'can_class_subject_read'], scope.establishmentId)) && this.license.canUse(`can_learning_content_${action}`, 'LEARNING_CONTENT', scope.establishmentId);
  }

  protected selectClass(id: string, select?: HTMLSelectElement): void {
    if (!this.pending.confirmLeave(() => this.selectClass(id, select))) { if (select) select.value = this.classId(); return; }
    const year = this.context.academicYear();
    if (!year || !this.classes().some((item) => item.id === id)) return;
    this.clearDetails();
    this.clearSubjects();
    this.classId.set(id);
    this.scope.set({ establishmentId: year.establishmentId, academicYearId: year.id, schoolClassId: id });
    this.load();
  }

  protected load(page = 0): void {
    const scope = this.scope();
    if (!scope || !this.pending.confirmLeave(() => this.load(page))) return;
    const revision = ++this.revision;
    this.page.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.api.list(scope, this.type, page).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { if (revision !== this.revision) return; this.page.set(result); this.loading.set(false); },
      error: (error) => { if (revision !== this.revision) return; this.fail(error); this.loading.set(false); }
    });
  }

  protected open(item: LearningContent): void {
    const scope = this.scope();
    if (!scope || !this.pending.confirmLeave(() => this.open(item))) return;
    this.clearDetails();
    this.detailsLoading.set(true);
    const revision = ++this.detailsRevision;
    this.api.get(scope, item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detail) => {
        if (revision !== this.detailsRevision) return;
        this.selected.set(detail);
        this.loadAttachments(scope, detail.id, revision);
      },
      error: (error) => { if (revision !== this.detailsRevision) return; this.fail(error); this.detailsLoading.set(false); }
    });
  }

  protected edit(item?: LearningContent): void {
    if (!this.allowed(item ? 'update' : 'create') || !this.pending.confirmLeave(() => this.edit(item))) return;
    if (!item) this.clearDetails();
    this.draft = item ? { type: item.type, title: item.title, description: item.description, body: item.body, subjectId: item.subjectId, dueDate: item.dueDate } : this.emptyDraft();
    this.editing.set(true);
    this.files.set([]);
    this.error.set(null);
    this.success.set(null);
    this.loadSubjects();
  }

  protected loadSubjects(): void {
    const scope = this.scope();
    if (!scope || 'studentId' in scope) return;
    const revision = ++this.subjectsRevision;
    this.subjects.set([]);
    this.subjectsLoading.set(true);
    this.subjectsError.set(null);
    forkJoin({
      subjects: this.subjectService.getSubjects(scope.establishmentId),
      assignments: this.subjectService.getClassSubjects(scope.establishmentId, scope.academicYearId, scope.schoolClassId)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ subjects, assignments }) => {
        if (revision !== this.subjectsRevision) return;
        const assigned = new Set(assignments.filter((assignment) => assignment.enabled &&
          assignment.establishmentId === scope.establishmentId && assignment.schoolClassId === scope.schoolClassId
        ).map((assignment) => assignment.subjectId));
        this.subjects.set(subjects.filter((subject) => subject.enabled &&
          subject.establishmentId === scope.establishmentId && assigned.has(subject.id)));
        this.subjectsLoading.set(false);
      },
      error: (error: unknown) => {
        if (revision !== this.subjectsRevision) return;
        this.subjectsError.set(apiError(error));
        this.subjectsLoading.set(false);
      }
    });
  }

  protected validSubject(): boolean {
    return this.subjects().some((subject) => subject.id === this.draft.subjectId);
  }

  protected change(): void { this.pending.dirty.set(true); }

  protected cancel(): void {
    if (!this.pending.confirmLeave(() => this.cancel())) return;
    this.editing.set(false);
    this.files.set([]);
  }

  protected chooseFiles(input: HTMLInputElement): void {
    this.error.set(null);
    const files = Array.from(input.files ?? []);
    const invalid = files.map(learningFileError).find((message) => message !== null);
    if (invalid) { this.error.set(invalid); input.value = ''; return; }
    this.files.update((current) => [...current, ...files]);
    if (files.length) this.change();
    input.value = '';
  }

  protected removeFile(index: number): void {
    this.files.update((files) => files.filter((_, position) => position !== index));
    this.change();
  }

  protected save(): void {
    const scope = this.scope();
    const current = this.selected();
    if (!scope || this.pending.saving() || !this.allowed(current ? 'update' : 'create') || !this.draft.title.trim()) return;
    if (this.subjectsLoading() || !this.validSubject()) {
      this.error.set('Choisissez une matière active affectée à la classe avant d’enregistrer le cours ou le devoir.');
      return;
    }
    this.pending.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    const request = { ...this.draft, title: this.draft.title.trim(), dueDate: this.draft.type === 'ASSIGNMENT' ? this.draft.dueDate || null : null };
    this.api.save(scope, request, current?.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (content) => {
        this.selected.set(content);
        this.pending.dirty.set(this.files().length > 0);
        if (this.files().length) this.uploadNext(scope, content.id);
        else this.finishSave(scope, content.id);
      },
      error: (error) => { this.fail(error, true); this.pending.saving.set(false); }
    });
  }

  protected transition(item: LearningContent, action: 'publish' | 'archive'): void {
    const scope = this.scope();

    if (!scope || !this.allowed(action) || !this.pending.confirmLeave(() => this.transition(item, action))) return;
    this.confirmation.confirm('Confirmer cette modification du contenu ?', () => {
    this.pending.saving.set(true);
    this.api.transition(scope, item.id, action).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.pending.saving.set(false); this.clearDetails(); this.success.set('Contenu mis à jour.'); this.load(); },
      error: (error) => { this.fail(error, true); this.pending.saving.set(false); }
    });

    });
  }

  protected download(item: LearningAttachment): void {
    const scope = this.scope();
    const content = this.selected();
    if (!scope || !content || this.downloadId()) return;
    this.downloadId.set(item.id);
    this.api.download(scope, content.id, item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        this.downloadId.set(null);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = item.fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => { this.downloadId.set(null); this.fail(error); }
    });
  }

  private uploadNext(scope: LearningScope, id: string): void {
    const file = this.files()[0];
    if (!file) { this.finishSave(scope, id); return; }
    this.uploadProgress.set(0);
    this.api.upload(scope, id, file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) this.uploadProgress.set(event.total ? Math.round(100 * event.loaded / event.total) : null);
        if (event.type === HttpEventType.Response) { this.files.update((files) => files.slice(1)); this.uploadNext(scope, id); }
      },
      error: (error) => { this.fail(error); this.pending.saving.set(false); this.pending.dirty.set(true); this.uploadProgress.set(null); }
    });
  }

  private finishSave(scope: LearningScope, id: string): void {
    this.pending.saving.set(false);
    this.pending.dirty.set(false);
    this.editing.set(false);
    this.uploadProgress.set(null);
    this.success.set('Contenu enregistré.');
    this.loadAttachments(scope, id, this.detailsRevision);
    this.load();
  }

  private loadAttachments(scope: LearningScope, id: string, revision: number): void {
    this.api.attachments(scope, id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (files) => { if (revision !== this.detailsRevision) return; this.attachments.set(files); this.detailsLoading.set(false); },
      error: (error) => { if (revision !== this.detailsRevision) return; this.fail(error); this.detailsLoading.set(false); }
    });
  }

  private clearDetails(): void {
    this.detailsRevision++;
    this.selected.set(null);
    this.attachments.set([]);
    this.files.set([]);
    this.editing.set(false);
    this.detailsLoading.set(false);
    this.pending.dirty.set(false);
  }

  private reset(): void {
    this.revision++;
    this.clearDetails();
    this.clearSubjects();
    this.scope.set(null);
    this.classes.set([]);
    this.classId.set('');
    this.page.set(null);
    this.error.set(null);
    this.success.set(null);
    this.loading.set(false);
    this.type = '';
  }

  private clearSubjects(): void {
    this.subjectsRevision++;
    this.subjects.set([]);
    this.subjectsLoading.set(false);
    this.subjectsError.set(null);
  }

  private fail(error: unknown, subjectValidation = false): void {
    if (subjectValidation && error instanceof HttpErrorResponse && error.status === 400) {
      this.error.set('Vérifiez les champs du contenu et sa matière. La matière doit toujours être affectée à cette classe, y compris lors de la publication.');
      return;
    }
    const scope = this.scope();
    const blocked = !!scope && 'establishmentId' in scope && this.license.decision('LEARNING_CONTENT', scope.establishmentId) === 'blocked';
    this.error.set(apiError(error, blocked));
  }

  private emptyDraft(): LearningRequest {
    return { type: 'LESSON', title: '', description: '', body: '', subjectId: '', dueDate: null };
  }
}
