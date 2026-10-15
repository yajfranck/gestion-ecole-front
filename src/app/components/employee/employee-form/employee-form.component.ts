import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmployeePosition } from '../../../models/position/position.model';
import { EmployeeService } from '../../../service/employee-service/employee.service';

@Component({
  selector: 'app-employee-form',
  imports: [FormsModule],
  templateUrl: './employee-form.component.html',
  styleUrl: './employee-form.component.css'
})
export class EmployeeFormComponent {
  private readonly service = inject(EmployeeService);

  readonly establishmentId = input.required<string>();
  readonly positions = input<EmployeePosition[]>([]);
  readonly isLoadingPositions = input(false);
  readonly positionError = input<string | null>(null);
  readonly invited = output<string>();

  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected employeeNumber = '';
  protected firstName = '';
  protected lastName = '';
  protected email = '';
  protected positionId = '';

  protected invite(): void {
    const request = {
      employeeNumber: this.employeeNumber.trim(),
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      email: this.email.trim(),
      positionId: this.positionId
    };
    if (!request.employeeNumber || !request.firstName || !request.lastName || !request.email || !request.positionId || this.isSaving()) return;

    this.errorMessage.set(null);
    this.isSaving.set(true);
    this.service.inviteEmployee(request).subscribe({
      next: () => {
        this.employeeNumber = '';
        this.firstName = '';
        this.lastName = '';
        this.email = '';
        this.positionId = '';
        this.isSaving.set(false);
        this.invited.emit(request.email);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.errorFor(error));
        this.isSaving.set(false);
      }
    });
  }

  private errorFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire.';
      if (error.status === 404) return 'Le poste sélectionné est introuvable ou inaccessible.';
      if (error.status === 409) return 'Un membre possède déjà cet e-mail ou ce matricule.';
      if (error.status === 503) return 'Le service de courriel est indisponible, l’invitation n’a pas été envoyée.';
      if (error.status === 0) return 'Le serveur est inaccessible. Vérifiez la connexion puis réessayez.';
    }
    return 'L’invitation n’a pas abouti. Vérifiez les informations puis réessayez.';
  }
}