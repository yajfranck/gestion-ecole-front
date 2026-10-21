import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormModalComponent, FormsModule, RouterLink],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css'
})
export class ChangePasswordComponent {
  private readonly authService = inject(AuthService);

  protected currentPassword = '';
  protected newPassword = '';
  protected confirmPassword = '';
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected submit(): void {
    if (this.isSubmitting()) return;
    this.errorMessage.set(null);

    if (this.newPassword.length < 12 || new TextEncoder().encode(this.newPassword).length > 72) {
      this.errorMessage.set('Le nouveau mot de passe doit contenir au moins 12 caractères et ne pas dépasser 72 octets UTF-8.');
      return;
    }
    if (this.newPassword === this.currentPassword) {
      this.errorMessage.set('Le nouveau mot de passe doit être différent du mot de passe actuel.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    this.isSubmitting.set(true);
    this.authService.changePassword({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.authService.logout('/login?passwordChanged=true');
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(this.getErrorMessage(error));
      }
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Le nouveau mot de passe ne respecte pas les règles requises.';
      if (error.status === 401) return 'Votre session a expiré. Reconnectez-vous puis réessayez.';
      if (error.status === 403) return 'Le mot de passe actuel est incorrect.';
      if (error.status === 0) return 'Le serveur est inaccessible. Vérifiez la connexion puis réessayez.';
    }
    return 'Le changement de mot de passe n’a pas abouti. Réessayez.';
  }
}
