import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Establishment } from '../../../models/establishment/establishment.model';
import { EstablishmentService } from '../../../service/establishment-service/establishment.service';

@Component({
  selector: 'app-establishments',
  imports: [FormsModule, RouterLink],
  templateUrl: './establishment-list.component.html',
  styleUrl: './establishment-list.component.css'
})
export class EstablishmentsComponent implements OnInit {
  private readonly establishmentService = inject(EstablishmentService);

  protected readonly establishments = signal<Establishment[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly createError = signal<string | null>(null);
  protected readonly isCreating = signal(false);
  protected readonly createSuccess = signal<string | null>(null);
  protected readonly deactivatingId = signal<string | null>(null);
  protected readonly deactivateError = signal<string | null>(null);
  protected code = '';
  protected name = '';
  protected administratorEmployeeNumber = '';
  protected administratorFirstName = '';
  protected administratorLastName = '';
  protected administratorEmail = '';

  ngOnInit(): void {
    this.loadEstablishments();
  }

  protected loadEstablishments(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.establishmentService.getAccessible().subscribe({
      next: (establishments) => {
        this.establishments.set(establishments);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.getErrorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  protected createEstablishment(): void {
    const code = this.code.trim();
    const name = this.name.trim();
    const employeeNumber = this.administratorEmployeeNumber.trim();
    const firstName = this.administratorFirstName.trim();
    const lastName = this.administratorLastName.trim();
    const email = this.administratorEmail.trim();
    if (!code || !name || !employeeNumber || !firstName || !lastName || !email || this.isCreating()) {
      return;
    }

    this.createError.set(null);
    this.createSuccess.set(null);
    this.isCreating.set(true);
    this.establishmentService.create({
      code,
      name,
      administrator: { employeeNumber, firstName, lastName, email }
    }).subscribe({
      next: ({ establishment }) => {
        this.code = '';
        this.name = '';
        this.administratorEmployeeNumber = '';
        this.administratorFirstName = '';
        this.administratorLastName = '';
        this.administratorEmail = '';
        this.isCreating.set(false);
        this.createSuccess.set(`L’établissement « ${establishment.name} » a été créé. Une invitation a été envoyée à ${email}.`);
        this.loadEstablishments();
      },
      error: (error: unknown) => {
        this.createError.set(this.getCreateErrorMessage(error));
        this.isCreating.set(false);
      }
    });
  }

  protected deactivateEstablishment(establishment: Establishment): void {
    if (this.deactivatingId() || !window.confirm(`Désactiver l’établissement « ${establishment.name} » ? Son personnel et leurs comptes seront aussi désactivés.`)) {
      return;
    }

    this.deactivateError.set(null);
    this.createSuccess.set(null);
    this.deactivatingId.set(establishment.id);
    this.establishmentService.deactivate(establishment.id).subscribe({
      next: () => {
        this.deactivatingId.set(null);
        this.createSuccess.set(`L’établissement « ${establishment.name} » a été désactivé.`);
        this.loadEstablishments();
      },
      error: (error: unknown) => {
        this.deactivateError.set(this.getDeactivateErrorMessage(error));
        this.deactivatingId.set(null);
      }
    });
  }

  private getDeactivateErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'Seul un administrateur autorisé peut désactiver un établissement.';
      if (error.status === 404) return 'Cet établissement est absent ou déjà désactivé.';
    }

    return 'Impossible de désactiver l’établissement. Réessayez.';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return 'Votre compte ne dispose pas de l’autorisation nécessaire pour consulter les établissements.';
    }

    return 'Impossible de charger les établissements. Vérifiez la connexion au serveur puis réessayez.';
  }

  private getCreateErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) {
        return 'Seul un administrateur autorisé peut créer un établissement.';
      }
      if (error.status === 409) {
        return 'Ce code établissement, ce matricule ou cette adresse e-mail est déjà utilisé.';
      }
      if (error.status === 503) {
        return 'L’établissement n’a pas été créé : le service de courriel est indisponible et l’invitation n’a pas été envoyée.';
      }
    }

    return 'Impossible de créer l’établissement. Vérifiez les informations puis réessayez.';
  }
}