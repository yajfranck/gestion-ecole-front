import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected login = '';
  protected password = '';
  protected passwordVisible = false;
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly passwordChanged = this.activatedRoute.snapshot.queryParamMap.has('passwordChanged');
  protected readonly invitationAccepted = this.activatedRoute.snapshot.queryParamMap.has('invitationAccepted');

  protected submit(): void {
    const login = this.login.trim();
    if (!login || !this.password || this.isSubmitting()) {
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    this.authService.login({ login, password: this.password }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        const returnUrl = this.activatedRoute.snapshot.queryParamMap.get('returnUrl');
        const destination = returnUrl?.startsWith('/') && !returnUrl.startsWith('//')
          ? returnUrl
          : '/dashboard';
        void this.router.navigateByUrl(destination);
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(this.getErrorMessage(error));
      }
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        return 'Identifiant ou mot de passe incorrect.';
      }

      if (error.status === 0) {
        return 'Le serveur est momentanément inaccessible. Réessayez dans un instant.';
      }
    }

    return 'La connexion n’a pas pu aboutir. Réessayez.';
  }
}