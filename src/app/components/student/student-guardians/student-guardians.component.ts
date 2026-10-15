import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Guardian } from '../../../models/guardian/guardian.model';
import { Student } from '../../../models/student/student.model';
import { GuardianService } from '../../../service/guardian-service/guardian.service';
import { StudentService } from '../../../service/student-service/student.service';

@Component({
  selector: 'app-student-guardians',
  imports: [FormsModule],
  templateUrl: './student-guardians.component.html',
  styleUrl: './student-guardians.component.css'
})
export class StudentGuardiansComponent implements OnInit {
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

  protected link(): void {
    const firstName = this.firstName.trim();
    const lastName = this.lastName.trim();
    const email = this.email.trim();
    if (!firstName || !lastName || !email || this.isLinking()) return;

    this.isLinking.set(true);
    this.actionError.set(null);
    this.successMessage.set(null);
    this.guardianService.linkGuardian(this.establishmentId(), this.studentId(), { firstName, lastName, email }).subscribe({
      next: (link) => {
        this.firstName = '';
        this.lastName = '';
        this.email = '';
        this.isLinking.set(false);
        this.successMessage.set(link.accessStatus === 'INVITATION_SENT'
          ? `Le tuteur a été lié. Une invitation a été envoyée à ${link.guardian.email}.`
          : 'Le tuteur a été lié. Son accès parent est déjà actif.');
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error));
        this.isLinking.set(false);
      }
    });
  }

  protected unlink(guardian: Guardian): void {
    if (this.unlinkingId() || !window.confirm(`Retirer ${guardian.firstName} ${guardian.lastName} des tuteurs de cet élève ?`)) return;

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
  }

  private failLoad(error: unknown): void {
    this.loadError.set(this.errorMessage(error));
    this.isLoading.set(false);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Vérifiez le prénom, le nom et l’adresse e-mail du tuteur.';
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'Cet élève ou ce lien est absent ou inaccessible.';
      if (error.status === 409) return 'Ce tuteur est déjà lié à cet élève.';
      if (error.status === 503) return 'L’envoi de l’invitation est momentanément indisponible. Réessayez plus tard.';
    }
    return 'Impossible de charger ou d’enregistrer ces informations. Vérifiez le serveur puis réessayez.';
  }
}
