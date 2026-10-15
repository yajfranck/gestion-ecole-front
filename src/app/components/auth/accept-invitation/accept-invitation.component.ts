import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EmployeeService } from '../../../service/employee-service/employee.service';
import { GuardianService } from '../../../service/guardian-service/guardian.service';

@Component({
  selector: 'app-accept-invitation',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './accept-invitation.component.html',
  styleUrl: './accept-invitation.component.css'
})
export class AcceptInvitationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly guardianService = inject(GuardianService);
  private readonly employeeService = inject(EmployeeService);

  protected readonly isGuardian = this.route.snapshot.data?.['invitationType'] === 'guardian';
  protected readonly token = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected password = '';
  protected confirmPassword = '';

  ngOnInit(): void {
    const fragment = this.route.snapshot.fragment ?? '';
    const token = new URLSearchParams(fragment).get('token')?.trim() ?? '';
    if (token.length > 0 && token.length <= 100) {
      this.token.set(token);
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
      return;
    }

    this.errorMessage.set('Le lien d’invitation est absent ou invalide. Demandez une nouvelle invitation à votre administrateur.');
  }

  protected submit(): void {
    if (!this.token() || this.isSubmitting()) return;

    const passwordLength = Array.from(this.password).length;
    const passwordBytes = new TextEncoder().encode(this.password).length;
    if (passwordLength < 12 || passwordBytes > 72) {
      this.errorMessage.set('Le mot de passe doit contenir au moins 12 caractères et ne pas dépasser 72 octets UTF-8.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('La confirmation ne correspond pas au mot de passe.');
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);
    const request = { token: this.token(), password: this.password };
    const call = this.isGuardian ? this.guardianService.acceptInvitation(request) : this.employeeService.acceptInvitation(request);
    call.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/login'], { queryParams: { invitationAccepted: true } });
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.errorFor(error));
        this.isSubmitting.set(false);
      }
    });
  }

  private errorFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Le mot de passe ne respecte pas les règles requises.';
      if (error.status === 401) return 'Ce lien d’invitation est invalide, expiré ou a déjà été utilisé. Demandez une nouvelle invitation.';
      if (error.status === 0) return 'Le serveur est inaccessible. Vérifiez la connexion puis réessayez.';
    }
    return 'L’activation du compte n’a pas abouti. Réessayez.';
  }
}