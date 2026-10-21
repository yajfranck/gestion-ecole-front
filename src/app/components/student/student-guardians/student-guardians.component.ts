import { ToastService } from '../../../service/toast-service/toast.service';
import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Guardian } from '../../../models/guardian/guardian.model';
import { Student } from '../../../models/student/student.model';
import { GuardianService } from '../../../service/guardian-service/guardian.service';
import { StudentService } from '../../../service/student-service/student.service';

@Component({
  selector: 'app-student-guardians',
  imports: [FormModalComponent, PermissionDirective, FormsModule],
  templateUrl: './student-guardians.component.html',
  styleUrl: './student-guardians.component.css'
})
export class StudentGuardiansComponent implements OnInit {
  private readonly toast = inject(ToastService);

  constructor() {
    this.toast.connect(this.successMessage, 'success');
    this.toast.connect(this.actionError, 'error');
  }

  private readonly confirmation = inject(ConfirmationDialogService);
  protected readonly access = inject(WorkspaceAccessService);
  private readonly guardianService = inject(GuardianService);
  private readonly studentService = inject(StudentService);

  readonly establishmentId = input.required<string>();
  readonly studentId = input.required<string>();

  protected readonly student = signal<Student | null>(null);
  protected readonly guardians = signal<Guardian[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLinking = signal(false);
  protected readonly unlinkingId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected firstName = '';
  protected lastName = '';
  protected email = '';

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.studentService.getStudent(this.establishmentId(), this.studentId()).subscribe({
      next: (student) => {
        this.student.set(student);
        this.guardianService.getGuardians(this.establishmentId(), this.studentId()).subscribe({
          next: (guardians) => {
            this.guardians.set(guardians);
            this.isLoading.set(false);
          },
          error: (error: unknown) => this.failLoad(error)
        });
      },
      error: (error: unknown) => this.failLoad(error)
    });
  }

  protected link(form: NgForm): void {
    if (!this.access.hasPermission('can_guardian_link', this.establishmentId())) return;
    if (this.isLinking()) return;

    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();
    const email = this.email.trim().toLowerCase();
    this.successMessage.set(null);
    if (form.invalid || !firstName || !lastName || !email) {
      form.control.markAllAsTouched();
      this.actionError.set('Vérifiez le prénom, le nom (100 caractères maximum chacun) et l’adresse e-mail (254 caractères maximum).');
      return;
    }

    this.isLinking.set(true);
    this.actionError.set(null);
    this.guardianService.linkGuardian(this.establishmentId(), this.studentId(), { firstName, lastName, email }).subscribe({
      next: (link) => {
        form.resetForm();
        this.firstName = '';
        this.lastName = '';
        this.email = '';
        this.isLinking.set(false);
        this.successMessage.set(link.accessStatus === 'INVITATION_SENT'
          ? `Le tuteur a été lié. Une invitation a été envoyée à ${link.guardian.email}.`
          : `Le tuteur a été lié au compte existant de ${link.guardian.email}, sans nouvelle invitation. Ses rôles et son mot de passe sont conservés. Pour accéder à ses enfants, le tuteur doit se reconnecter si cet accès vient d’être ajouté.`);
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error));
        this.isLinking.set(false);
      }
    });
  }

  protected unlink(guardian: Guardian): void {
    if (!this.access.hasPermission('can_guardian_unlink', this.establishmentId())) return;

    if (this.unlinkingId()) return;
    this.confirmation.confirm(`Retirer ${guardian.firstName} ${guardian.lastName} des tuteurs de cet élève ?`, () => {

    this.unlinkingId.set(guardian.id);
    this.actionError.set(null);
    this.successMessage.set(null);
    this.guardianService.unlinkGuardian(this.establishmentId(), this.studentId(), guardian.id).subscribe({
      next: () => {
        this.unlinkingId.set(null);
        this.successMessage.set('Le lien avec ce tuteur a été retiré.');
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error));
        this.unlinkingId.set(null);
      }
    });

    });
  }

  private failLoad(error: unknown): void {
    this.loadError.set(this.errorMessage(error));
    this.isLoading.set(false);
  }

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
