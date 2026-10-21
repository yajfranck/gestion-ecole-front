import { ToastService } from '../../../service/toast-service/toast.service';
import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, OnInit, signal, viewChild, ElementRef, DestroyRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { DialogComponent } from '../../../shared/dialog/dialog.component';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { SchoolClassDetailComponent } from '../school-class-detail/school-class-detail.component';
import { SchoolClassFormComponent } from '../school-class-form/school-class-form.component';
import { SchoolClassGridComponent } from '../school-class-grid/school-class-grid.component';
import { ClassSubjectManagerComponent } from '../../subject/class-subject-manager/class-subject-manager.component';
import { ClassroomManagerComponent } from '../../classroom/classroom-manager/classroom-manager.component';
import { Classroom } from '../../../models/classroom/classroom.model';
import { SchoolClassCapacityService } from '../../../service/school-class-capacity-service/school-class-capacity.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-school-class-manager',
  providers: [SchoolClassCapacityService],
  imports: [FormModalComponent, FormsModule, DialogComponent, SchoolClassDetailComponent, SchoolClassFormComponent, SchoolClassGridComponent, ClassSubjectManagerComponent, ClassroomManagerComponent],
  templateUrl: './school-class-manager.component.html',
  styleUrl: './school-class-manager.component.css'
})
export class SchoolClassManagerComponent implements OnInit {
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly capacity = inject(SchoolClassCapacityService);

  constructor() {
    this.toast.connect(this.successMessage, 'success');
    this.toast.connect(this.actionError, 'error');
  }

  private readonly confirmation = inject(ConfirmationDialogService);
  protected readonly access = inject(WorkspaceAccessService);
  private readonly workspace = inject(WorkspaceContextService);
  private readonly academicYearService = inject(AcademicYearService);

  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();
  readonly initialClassId = input<string | null>(null);

  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly archivingId = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly createOpen = signal(false);
  protected readonly createTrigger = viewChild<ElementRef<HTMLButtonElement>>('createTrigger');
  protected readonly searchTerm = signal('');
  protected readonly selectedSeries = signal('');
  protected readonly seriesOptions = computed(() => [...new Set(this.classes()
    .map((schoolClass) => schoolClass.series?.trim())
    .filter((series): series is string => !!series))].sort((left, right) => left.localeCompare(right, 'fr')));
  protected readonly filteredClasses = computed(() => {
    const search = this.searchTerm().trim().toLocaleLowerCase('fr');
    const series = this.selectedSeries();
    return this.classes().filter((schoolClass) => {
      const matchesSearch = !search || [schoolClass.name, schoolClass.code, schoolClass.series ?? '']
        .some((value) => value.toLocaleLowerCase('fr').includes(search));
      return matchesSearch && (!series || schoolClass.series?.trim() === series);
    });
  });

  protected code = '';
  protected name = '';
  protected series = '';
  protected readonly isCreating = signal(false);
  protected readonly management = signal<{ kind: 'subjects' | 'rooms'; schoolClass: SchoolClass; trigger: HTMLElement | null } | null>(null);
  private readonly subjectManager = viewChild(ClassSubjectManagerComponent);
  private readonly roomManager = viewChild(ClassroomManagerComponent);
  private readonly classDetail = viewChild(SchoolClassDetailComponent);
  protected readonly managementBusy = computed(() => !!(this.subjectManager()?.busy() || this.roomManager()?.saving()));

  protected openManagement(schoolClass: SchoolClass, kind: 'subjects' | 'rooms', event: Event): void {
    if (this.managementBusy() || !this.can('read') || (kind === 'subjects' && !this.access.hasPermission('can_class_subject_read', this.establishmentId()))) return;
    this.management.set({ kind, schoolClass, trigger: event.currentTarget as HTMLElement | null });
  }

  protected closeManagement(): void { if (!this.managementBusy()) this.management.set(null); }

  protected updateClassrooms(schoolClassId: string, rooms: Classroom[]): void {
    this.capacity.setClassrooms(schoolClassId, rooms);
    if (this.classDetail()?.schoolClassId() === schoolClassId) this.classDetail()?.setClassrooms(rooms);
  }

  protected refreshCapacity(): void {
    this.capacity.load(this.establishmentId(), this.academicYearId(), this.classes().map(schoolClass => schoolClass.id));
  }

  protected can(action: 'read' | 'create' | 'update' | 'delete'): boolean {
    return this.access.hasPermission(`can_school_class_${action}`, this.establishmentId());
  }

  protected establishmentName(): string {
    const context = this.workspace.current();
    return context?.establishmentId === this.establishmentId() ? context.establishmentName : 'Établissement sélectionné';
  }

  protected academicYearName(): string {
    const context = this.workspace.current();
    return context?.establishmentId === this.establishmentId() && context.academicYearId === this.academicYearId()
      ? context.academicYearName ?? 'Année scolaire sélectionnée'
      : 'Année scolaire sélectionnée';
  }

  protected openCreate(): void {
    if (!this.can('create')) return;
    this.successMessage.set(null);
    this.createOpen.set(true);
  }

  protected closeCreate(): void {
    if (this.isCreating()) return;
    this.createOpen.set(false);
  }

  protected clearFilters(): void {
    this.searchTerm.set('');
    this.selectedSeries.set('');
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    if (!this.access.hasPermission('can_school_class_read', this.establishmentId())) { this.isLoading.set(false); return; }
    this.isLoading.set(true);
    this.loadError.set(null);
    this.academicYearService.getClasses(this.establishmentId(), this.academicYearId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (classes) => {
        this.classes.set(classes.filter(schoolClass => schoolClass.enabled && schoolClass.establishmentId === this.establishmentId() && schoolClass.academicYearId === this.academicYearId()));
        this.refreshCapacity();
        const initial = this.initialClassId();
        if (initial && this.expandedId() === null && classes.some((item) => item.id === initial)) {
          this.expandedId.set(initial);
        }
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(this.errorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  protected onCreated(classes: SchoolClass[]): void {
    this.createOpen.set(false);
    this.successMessage.set(classes.length === 1
      ? `La classe « ${classes[0].name} » a été créée. Ajoutez ses salles depuis le bouton Salles.`
      : `${classes.length} classes ont été créées. Ajoutez leurs salles depuis le bouton Salles.`);
    this.load();
  }

  protected toggleDetail(schoolClass: SchoolClass): void {
    this.expandedId.set(this.expandedId() === schoolClass.id ? null : schoolClass.id);
  }

  protected startEditing(schoolClass: SchoolClass): void {
    if (!this.can('update')) return;
    this.editingId.set(schoolClass.id);
    this.code = schoolClass.code;
    this.name = schoolClass.name;
    this.series = schoolClass.series ?? '';
    this.actionError.set(null);
    this.successMessage.set(null);
  }

  protected cancelEditing(): void {
    this.editingId.set(null);
    this.actionError.set(null);
  }

  protected save(schoolClass: SchoolClass): void {
    if (!this.can('update')) return;
    const code = this.code.trim();
    const name = this.name.trim();
    if (!code || !name || this.isSaving()) return;
    if (code.length > 40 || name.length > 100 || this.series.trim().length > 100) { this.actionError.set('Vérifiez le code, le nom et la série de la classe.'); return; }

    this.isSaving.set(true);
    this.actionError.set(null);
    this.academicYearService.updateClass(this.establishmentId(), this.academicYearId(), schoolClass.id, { code, name, series: this.series.trim() }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.editingId.set(null);
        this.successMessage.set(`La classe « ${name} » a été modifiée.`);
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error));
        this.isSaving.set(false);
      }
    });
  }

  protected archive(schoolClass: SchoolClass): void {
    if (!this.can('delete')) return;

    if (this.archivingId()) return;
    this.confirmation.confirm(`Archiver la classe « ${schoolClass.name} » ?`, () => {

    this.archivingId.set(schoolClass.id);
    this.actionError.set(null);
    this.successMessage.set(null);
    this.academicYearService.archiveClass(this.establishmentId(), this.academicYearId(), schoolClass.id).subscribe({
      next: () => {
        this.archivingId.set(null);
        if (this.expandedId() === schoolClass.id) this.expandedId.set(null);
        this.successMessage.set(`La classe « ${schoolClass.name} » a été archivée.`);
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error));
        this.archivingId.set(null);
      }
    });

    });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Vérifiez le code, le nom et la série de la classe.';
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'Cette classe ou cette année scolaire est absente ou inaccessible.';
      if (error.status === 409) return 'Le code de classe existe déjà dans cette année scolaire.';
    }
    return 'Impossible de traiter les classes. Vérifiez le serveur puis réessayez.';
  }
}
