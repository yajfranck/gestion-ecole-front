import { Component, computed, DestroyRef, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { concatMap, from, tap } from 'rxjs';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { Guardian, GuardianLink, LinkGuardianRequest } from '../../../models/guardian/guardian.model';
import { Student } from '../../../models/student/student.model';
import { EnrollmentContextService } from '../../../service/enrollment-context-service/enrollment-context.service';
import { GuardianService } from '../../../service/guardian-service/guardian.service';
import { StudentService } from '../../../service/student-service/student.service';
import { ToastService } from '../../../service/toast-service/toast.service';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { GuardianFormComponent } from '../guardian-form/guardian-form.component';

@Component({
  selector: 'app-student-guardians',
  imports: [FormModalComponent, PermissionDirective, GuardianFormComponent],
  templateUrl: './student-guardians.component.html',
  styleUrl: './student-guardians.component.css'
})
export class StudentGuardiansComponent implements OnInit {
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(ConfirmationDialogService);
  protected readonly access = inject(WorkspaceAccessService);
  private readonly guardianService = inject(GuardianService);
  private readonly studentService = inject(StudentService);
  private readonly context = inject(EnrollmentContextService, { optional: true });
  private readonly editor = viewChild(GuardianFormComponent);
  readonly establishmentId = input.required<string>();
  readonly studentId = input.required<string>();
  readonly readOnly = input(false);
  readonly embedded = input(false);
  readonly initialGuardian = input<LinkGuardianRequest | null>(null);
  readonly initialGuardians = input<LinkGuardianRequest[] | null>(null);
  readonly guardiansLoaded = output<Guardian[]>();
  readonly guardianLinked = output<GuardianLink>();
  readonly busyChange = output<boolean>();
  readonly draftsChanged = output<void>();
  readonly continued = output<void>();
  protected readonly student = signal<Student | null>(null);
  protected readonly guardians = signal<Guardian[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLinking = signal(false);
  protected readonly unlinkingId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly initialValues = computed(() => this.initialGuardians() ?? (this.initialGuardian() ? [this.initialGuardian()!] : []));

  constructor() {
    this.toast.connect(this.successMessage, 'success');
    this.toast.connect(this.actionError, 'error');
  }

  snapshots(): LinkGuardianRequest[] { return this.editor()?.snapshot() ?? this.initialValues(); }
  snapshot(): LinkGuardianRequest { return this.snapshots()[0] ?? { firstName: '', lastName: '', email: '' }; }
  canContinue(): boolean { return !!this.editor() && !this.isLoading() && !this.isLinking() && !this.unlinkingId(); }
  saveAndContinue(): void { if (!this.readOnly()) this.editor()?.submit(); }
  ngOnInit(): void { this.load(); }

  protected load(): void {
    this.isLoading.set(true); this.busyChange.emit(true); this.loadError.set(null);
    const student = this.context?.getStudent(this.establishmentId(), this.studentId()) ?? this.studentService.getStudent(this.establishmentId(), this.studentId());
    student.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: student => {
        this.student.set(student);
        if (!this.access.hasPermission('can_guardian_read', this.establishmentId())) { this.isLoading.set(false); this.busyChange.emit(false); this.guardiansLoaded.emit([]); return; }
        const guardians = this.context?.getGuardians(this.establishmentId(), this.studentId()) ?? this.guardianService.getGuardians(this.establishmentId(), this.studentId());
        guardians.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: guardians => { this.guardians.set(guardians); this.isLoading.set(false); this.busyChange.emit(false); this.guardiansLoaded.emit(guardians); },
          error: (error: unknown) => this.failLoad(error)
        });
      },
      error: (error: unknown) => this.failLoad(error)
    });
  }

  protected link(requests: LinkGuardianRequest[]): void {
    if (this.readOnly() || this.isLinking() || this.isLoading() || this.unlinkingId()) return;
    if (!requests.length) { if (this.guardians().length) this.continued.emit(); return; }
    if (!this.access.hasPermission('can_guardian_link', this.establishmentId())) return;
    this.isLinking.set(true); this.busyChange.emit(true); this.actionError.set(null); this.successMessage.set(null);
    let saved = 0;
    // L’API accepte un tuteur par requête. Une réussite partielle reste acquise et ne sera pas rejouée.
    from(requests).pipe(
      concatMap(request => this.guardianService.linkGuardian(this.establishmentId(), this.studentId(), request).pipe(tap(link => {
        this.updateGuardians([...this.guardians().filter(guardian => guardian.id !== link.guardian.id), link.guardian]);
        this.editor()?.accept(link.guardian);
        this.guardianLinked.emit(link);
        saved++;
      }))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      complete: () => {
        if (this.destroyRef.destroyed) return;
        this.isLinking.set(false); this.busyChange.emit(false);
        this.successMessage.set(saved === 1 ? 'Le tuteur a été enregistré.' : `${saved} tuteurs ont été enregistrés.`);
        this.continued.emit();
      },
      error: (error: unknown) => {
        this.isLinking.set(false); this.busyChange.emit(false); this.actionError.set(this.errorMessage(error));
        if (saved) this.toast.success(`${saved} tuteur(s) enregistré(s). Les lignes restantes sont conservées.`);
      }
    });
  }

  protected unlink(guardian: Guardian): void {
    if (this.readOnly() || !this.access.hasPermission('can_guardian_unlink', this.establishmentId()) || this.unlinkingId() || this.isLinking() || this.isLoading()) return;
    this.confirmation.confirm(`Retirer ${guardian.firstName} ${guardian.lastName} des tuteurs de cet élève ?`, () => {
      if (this.destroyRef.destroyed || this.readOnly() || this.unlinkingId() || this.isLinking() || this.isLoading() || !this.access.hasPermission('can_guardian_unlink', this.establishmentId())) return;
      this.unlinkingId.set(guardian.id); this.busyChange.emit(true); this.actionError.set(null); this.successMessage.set(null);
      this.guardianService.unlinkGuardian(this.establishmentId(), this.studentId(), guardian.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.unlinkingId.set(null); this.busyChange.emit(false);
          this.updateGuardians(this.guardians().filter(item => item.id !== guardian.id));
          this.successMessage.set('Le lien avec ce tuteur a été retiré.');
        },
        error: (error: unknown) => { this.actionError.set(this.errorMessage(error)); this.unlinkingId.set(null); this.busyChange.emit(false); }
      });
    });
  }

  private updateGuardians(guardians: Guardian[]): void {
    this.context?.setGuardians(this.establishmentId(), this.studentId(), guardians);
    this.guardians.set(guardians); this.guardiansLoaded.emit(guardians);
  }
  private failLoad(error: unknown): void { this.loadError.set(this.errorMessage(error)); this.isLoading.set(false); this.busyChange.emit(false); this.guardiansLoaded.emit([]); }
  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Vérifiez le prénom, le nom et l’adresse e-mail du tuteur.';
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'L’élève, le tuteur ou ce lien est absent, désactivé ou inaccessible dans cet établissement.';
      if (error.status === 409) return 'Ce tuteur est déjà lié à cet élève ou cette adresse e-mail est en conflit avec une autre identité. Vérifiez les liens existants et l’adresse saisie.';
      if (error.status === 503) return 'L’envoi de l’invitation est momentanément indisponible. Réessayez plus tard.';
    }
    return 'Impossible de charger ou d’enregistrer ces informations. Vérifiez le serveur puis réessayez.';
  }
}
