import { Component, computed, DestroyRef, effect, HostListener, inject, input, OnDestroy, output, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { EnrollmentDraft, EnrollmentIdentity } from '../../../models/enrollment/enrollment-draft.model';
import { Enrollment, EnrollmentCreation } from '../../../models/enrollment/enrollment.model';
import { Guardian, LinkGuardianRequest } from '../../../models/guardian/guardian.model';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { Student } from '../../../models/student/student.model';
import { EnrollmentDraftService } from '../../../service/enrollment-draft-service/enrollment-draft.service';
import { EnrollmentContextService } from '../../../service/enrollment-context-service/enrollment-context.service';
import { ToastService } from '../../../service/toast-service/toast.service';
import { PendingChangesService } from '../../../shared/pending-changes.service';
import { StudentFormComponent } from '../../student/student-form/student-form.component';
import { StudentGuardiansComponent } from '../../student/student-guardians/student-guardians.component';
import { EnrollmentFormComponent } from '../enrollment-form/enrollment-form.component';

@Component({
  selector: 'app-enrollment-journey',
  imports: [FormsModule, StudentFormComponent, StudentGuardiansComponent, EnrollmentFormComponent],
  providers: [EnrollmentContextService],
  templateUrl: './enrollment-journey.component.html',
  styleUrl: './enrollment-journey.component.css'
})
export class EnrollmentJourneyComponent implements OnDestroy {
  protected readonly access = inject(WorkspaceAccessService);
  private readonly drafts = inject(EnrollmentDraftService);
  private readonly context = inject(EnrollmentContextService);
  private readonly toast = inject(ToastService);
  private readonly pending = inject(PendingChangesService);
  private readonly destroyRef = inject(DestroyRef);
  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();
  readonly students = input<Student[]>([]);
  readonly classes = input<SchoolClass[]>([]);
  readonly enrollments = input<Enrollment[]>([]);
  readonly draft = input<EnrollmentDraft | null>(null);
  readonly initialStudentId = input('');
  readonly initialClassId = input('');
  readonly initialClassroomId = input('');
  readonly created = output<EnrollmentCreation>();
  readonly studentSaved = output<Student>();
  readonly closed = output<void>();
  readonly saving = signal(false);
  protected readonly step = signal(1);
  protected readonly student = signal<Student | null>(null);
  protected readonly mode = signal<'new' | 'existing'>('new');
  protected readonly guardianReady = signal(false);
  protected readonly guardianPending = signal(false);
  protected readonly identityPending = signal(false);
  protected readonly storageError = signal<string | null>(null);
  protected readonly identityInitial = signal<EnrollmentIdentity | null>(null);
  protected readonly guardiansInitial = signal<LinkGuardianRequest[]>([]);
  protected readonly selectionInitial = signal<EnrollmentDraft['selection'] | null>(null);
  protected readonly unavailable = signal(false);
  protected existingId = '';
  protected existingSearch = '';
  private currentDraft: EnrollmentDraft | null = null;
  private completed = false;
  private restoreStep = 1;
  private readonly identityForm = viewChild(StudentFormComponent);
  private readonly guardianForm = viewChild(StudentGuardiansComponent);
  private readonly enrollmentForm = viewChild(EnrollmentFormComponent);
  protected readonly isFinalStep = computed(() => this.step() === 3 && this.enrollmentForm()?.isLastStep() === true);
  protected readonly journeyStudents = computed(() => {
    const selected = this.student();
    return selected ? [selected, ...this.students().filter(student => student.id !== selected.id)] : this.students();
  });

  constructor() {
    effect(() => {
      const draft = this.draft();
      const establishmentId = this.establishmentId();
      const academicYearId = this.academicYearId();
      untracked(() => {
        this.context.clear();
        this.currentDraft = draft ? structuredClone(draft) : this.drafts.create(establishmentId, academicYearId);
        if (!draft) {
          this.currentDraft.selection.schoolClassId = this.initialClassId();
          this.currentDraft.selection.classroomId = this.initialClassroomId();
        }
        this.restoreStep = this.currentDraft.step;
        this.identityInitial.set(this.currentDraft.identity);
        this.guardiansInitial.set(this.currentDraft.guardians?.length ? this.currentDraft.guardians : [this.currentDraft.guardian]);
        this.guardianPending.set(this.guardiansInitial().some(guardian => !!(guardian.firstName.trim() || guardian.lastName.trim() || guardian.email.trim())));
        this.selectionInitial.set(this.currentDraft.selection);
        this.mode.set(this.access.hasPermission('can_student_create', establishmentId) ? 'new' : 'existing');
        const id = this.currentDraft.studentId || this.initialStudentId();
        if (id) {
          const student = this.students().find(student => student.id === id && student.enabled && student.establishmentId === establishmentId);
          if (student && !this.enrollments().some(enrollment => enrollment.studentId === id)) {
            this.student.set(student);
            this.context.setStudent(student);
            this.currentDraft.studentId = student.id;
            if (!draft?.studentId || draft.step !== 1 || !this.access.hasPermission('can_student_update', establishmentId)) {
              this.currentDraft.identity = { firstName: student.firstName, lastName: student.lastName };
            }
            this.identityInitial.set(structuredClone(this.currentDraft.identity));
            this.step.set(draft?.step === 1 ? 1 : 2);
            this.persist();
          }
          else { this.unavailable.set(true); this.mode.set('existing'); }
        }
      });
    });
  }

  protected enrolled(id: string): boolean { return this.enrollments().some(enrollment => enrollment.studentId === id); }
  protected matchingStudents(): Student[] {
    const search = this.existingSearch.trim().toLocaleLowerCase('fr');
    return this.students().filter(student => student.enabled && (!search || `${student.firstName} ${student.lastName} ${student.studentNumber}`.toLocaleLowerCase('fr').includes(search)));
  }

  protected switchMode(mode: 'new' | 'existing'): void {
    if (this.saving()) return;
    this.persist();
    if (this.currentDraft) this.identityInitial.set(structuredClone(this.currentDraft.identity));
    this.mode.set(mode);
  }

  protected chooseExisting(): void {
    const student = this.students().find(student => student.id === this.existingId && student.enabled && student.establishmentId === this.establishmentId());
    if (!student || this.enrolled(student.id)) return;
    this.acceptStudent(student);
    this.persist();
  }

  protected acceptStudent(student: Student): void {
    this.student.set(student);
    this.context.setStudent(student);
    this.studentSaved.emit(student);
    this.unavailable.set(false);
    if (this.currentDraft) {
      this.currentDraft.studentId = student.id;
      this.currentDraft.identity = { firstName: student.firstName, lastName: student.lastName };
    }
    this.identityInitial.set({ firstName: student.firstName, lastName: student.lastName });
    this.identityPending.set(false);
    this.guardianReady.set(false);
    this.step.set(2);
    this.persist();
  }

  protected onStudentUpdated(student: Student): void {
    const previous = this.student();
    if (previous && (previous.firstName !== student.firstName || previous.lastName !== student.lastName)) this.toast.success('L’identité de l’élève a été mise à jour.');
    this.acceptStudent(student);
  }

  protected onGuardians(guardians: Guardian[]): void {
    this.guardianReady.set(guardians.length > 0);
    if (this.restoreStep === 3 && guardians.length && !this.guardianPending()) {
      this.restoreStep = 1;
      this.step.set(3);
      this.persist();
    }
  }

  protected onGuardianLinked(): void {
    this.guardianReady.set(true);
    this.guardianPending.set(false);
    this.persist();
  }

  protected onGuardiansContinued(): void {
    this.persist();
    this.navigate(3);
  }

  protected previous(): void {
    if (this.saving()) return;
    if (this.step() === 3 && this.enrollmentForm()?.previous()) { this.persist(); return; }
    this.navigate(this.step() - 1);
  }

  protected canContinue(): boolean {
    if (this.saving()) return false;
    if (this.step() === 1) return !!this.student() || (this.mode() === 'new' ? this.access.hasPermission('can_student_create', this.establishmentId()) : !!this.existingId);
    if (this.step() === 2) return this.guardianForm()?.canContinue() ?? false;
    return this.enrollmentForm()?.canContinue() ?? false;
  }

  protected saveAndContinue(): void {
    if (!this.canContinue()) return;
    if (this.step() === 1) {
      if (this.identityForm()) this.identityForm()!.submit();
      else if (this.student()) this.navigate(2);
      else this.chooseExisting();
    } else if (this.step() === 2) this.guardianForm()?.saveAndContinue();
    else this.enrollmentForm()?.continue();
  }

  protected navigate(step: number): void {
    if (step < 1 || step > 3 || step === this.step() || this.saving() || (step > 1 && !this.student()) || (step === 3 && (!this.guardianReady() || this.guardianPending()))) return;
    this.persist();
    if (step > 1 && this.identityPending()) return;
    this.restoreStep = 1;
    if (step === 1) this.identityInitial.set(structuredClone(this.currentDraft!.identity));
    if (step === 2) {
      this.guardiansInitial.set(structuredClone(this.currentDraft!.guardians ?? [this.currentDraft!.guardian]));
      this.guardianReady.set(false);
    }
    this.step.set(step);
    if (step === 3) this.selectionInitial.set(structuredClone(this.currentDraft!.selection));
    this.persist();
  }

  protected onBusy(busy: boolean): void { this.saving.set(busy); this.pending.saving.set(busy); }
  protected onProgress(): void { this.persist(); }

  @HostListener('input')
  @HostListener('change')
  protected trackChanges(): void { this.persist(); }

  private hasContent(): boolean {
    return !!this.currentDraft && (!!this.currentDraft.studentId || !!this.currentDraft.identity.firstName.trim() || !!this.currentDraft.identity.lastName.trim()
      || !!this.currentDraft.guardian.email.trim() || !!this.currentDraft.selection.schoolClassId);
  }

  private persist(): boolean {
    if (this.completed) return true;
    if (!this.currentDraft || this.destroyRef.destroyed) return false;
    if (this.step() === 1) this.currentDraft.identity = this.identityForm()?.snapshot() ?? this.currentDraft.identity;
    const student = this.student();
    this.identityPending.set(!!student && (this.currentDraft.identity.firstName.trim() !== student.firstName || this.currentDraft.identity.lastName.trim() !== student.lastName));
    const guardians = this.step() === 2 ? this.guardianForm()?.snapshots() : undefined;
    if (guardians) {
      this.currentDraft.guardians = guardians;
      this.currentDraft.guardian = guardians[0] ?? { firstName: '', lastName: '', email: '' };
      this.guardianPending.set(guardians.some(guardian => !!(guardian.firstName.trim() || guardian.lastName.trim() || guardian.email.trim())));
    }
    const selection = this.step() === 3 ? this.enrollmentForm()?.snapshot() : undefined;
    if (selection) this.currentDraft.selection = selection;
    this.currentDraft.step = this.step();
    if (!this.hasContent()) { this.pending.dirty.set(false); return true; }
    const saved = this.drafts.save(this.currentDraft);
    this.storageError.set(saved ? null : 'La sauvegarde sur cet appareil est indisponible. Gardez cette fenêtre ouverte pour ne pas perdre la saisie en cours. Les étapes déjà validées restent enregistrées.');
    this.pending.dirty.set(!saved);
    return saved;
  }

  saveAndClose(): void {
    if (this.saving() || !this.persist()) return;
    if (this.hasContent()) this.toast.info('Parcours enregistré. Vous pourrez le reprendre depuis les inscriptions.');
    this.pending.dirty.set(false);
    this.closed.emit();
  }

  protected finish(enrollment: EnrollmentCreation): void {
    this.completed = true;
    if (this.currentDraft) this.drafts.remove(this.establishmentId(), this.academicYearId(), this.currentDraft.id);
    this.pending.dirty.set(false);
    this.pending.saving.set(false);
    this.saving.set(false);
    this.created.emit(enrollment);
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || !this.persist()) { event.preventDefault(); event.returnValue = ''; }
  }

  ngOnDestroy(): void { this.pending.dirty.set(false); this.pending.saving.set(false); }
}
