import { ToastService } from '../../../service/toast-service/toast.service';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of } from 'rxjs';
import { Establishment, OnboardEstablishmentRequest } from '../../../models/establishment/establishment.model';
import { LicenseSummary, summarizeLicenses } from '../../../models/license/license-summary';
import { EstablishmentService } from '../../../service/establishment-service/establishment.service';
import { LicenseService } from '../../../service/license-service/license.service';
import { EstablishmentCardComponent } from '../establishment-card/establishment-card.component';
import { EstablishmentLicenseFormComponent } from '../establishment-license-form/establishment-license-form.component';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { DialogComponent } from '../../../shared/dialog/dialog.component';
import { EstablishmentFormComponent } from '../establishment-form/establishment-form.component';
import { LicenseAccessService } from '../../../core/license-access.service';

@Component({
  selector: 'app-establishments',
  imports: [DialogComponent, EstablishmentFormComponent, PermissionDirective, FormsModule, RouterLink, EstablishmentCardComponent, EstablishmentLicenseFormComponent],
  templateUrl: './establishment-list.component.html',
  styleUrl: './establishment-list.component.css'
})
export class EstablishmentsComponent implements OnInit {
  private readonly toast = inject(ToastService);

  constructor() {
    this.toast.connect(this.createSuccess, 'success');
    this.toast.connect(this.createError, 'error');
    this.toast.connect(this.deactivateError, 'error');
  }

  private readonly confirmation = inject(ConfirmationDialogService);
  protected readonly access = inject(WorkspaceAccessService);
  private readonly establishmentService = inject(EstablishmentService);
  private readonly licenseService = inject(LicenseService);
  private readonly licenseAccess = inject(LicenseAccessService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly context = inject(WorkspaceContextService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly registrationMode = this.route.snapshot.data['licenseRegistration'] === true;

  protected readonly establishments = signal<Establishment[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly selectedStatus = signal<'all' | 'enabled' | 'disabled'>('all');
  protected readonly creationOpen = signal(false);
  protected readonly filteredEstablishments = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    const status = this.selectedStatus();
    return this.establishments().filter((establishment) => {
      const matchesQuery = !query || `${establishment.name} ${establishment.code}`.toLocaleLowerCase().includes(query);
      const matchesStatus = status === 'all' || establishment.enabled === (status === 'enabled');
      return matchesQuery && matchesStatus;
    });
  });
  protected readonly licenseSummaries = signal<Record<string, LicenseSummary | null>>({});
  protected readonly isLoadingLicenses = signal(false);
  /** Établissement sélectionné pour l’enregistrement en modale. */
  protected readonly licenseTarget = signal<Establishment | null>(null);
  protected readonly isRegisteringLicense = signal(false);
  protected licenseTrigger: HTMLElement | null = null;
  protected readonly pendingLicenseEstablishments = computed(() =>
    this.establishments().filter((establishment) => this.licenseSummaries()[establishment.id]?.status === 'NONE'));
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly createError = signal<string | null>(null);
  protected readonly isCreating = signal(false);
  protected readonly createSuccess = signal<string | null>(null);
  protected readonly deactivatingId = signal<string | null>(null);
  protected readonly deactivateError = signal<string | null>(null);
  protected creationTrigger: HTMLElement | null = null;

  ngOnInit(): void {
    if (this.registrationMode) {
      this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        this.licenseTarget.set(null);
        this.errorMessage.set(null);
        const id = params.get('establishmentId');
        if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          this.isLoading.set(false);
          this.errorMessage.set('L’identifiant de l’établissement est absent ou invalide.');
          return;
        }
        const state = this.location.getState() as { establishment?: Establishment } | null;
        const target = this.router.currentNavigation()?.extras.state?.['establishment'] ?? state?.establishment;
        if (target?.id === id && target.enabled && typeof target.name === 'string' && target.name.trim()) {
          this.licenseTarget.set(target);
          this.context.selectEstablishment(target);
          this.isLoading.set(false);
        } else if (this.access.has('can_establishment_read')) {
          this.isLoading.set(true);
          this.establishmentService.getAccessible().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (items) => {
              if (this.route.snapshot.paramMap.get('establishmentId') !== id) return;
              const establishment = items.find((item) => item.id === id && item.enabled);
              this.licenseTarget.set(establishment ?? null);
              if (establishment) this.context.selectEstablishment(establishment);
              else this.errorMessage.set('Cet établissement est absent ou inaccessible pour votre compte.');
              this.isLoading.set(false);
            },
            error: (error: unknown) => {
              if (this.route.snapshot.paramMap.get('establishmentId') !== id) return;
              this.errorMessage.set(this.getErrorMessage(error));
              this.isLoading.set(false);
            }
          });
        } else {
          this.isLoading.set(false);
          this.errorMessage.set('Le contexte de l’établissement est indisponible. Reprenez l’enregistrement depuis le portail.');
        }
      });
      return;
    }
    this.loadEstablishments();
  }

  protected loadEstablishments(): void {
    if (!this.access.has('can_establishment_read')) { this.isLoading.set(false); return; }
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.establishmentService.getAccessible().subscribe({
      next: (establishments) => {
        this.establishments.set(establishments);
        this.isLoading.set(false);
        this.loadLicenseSummaries(establishments);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.getErrorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  private loadLicenseSummaries(establishments: Establishment[]): void {
    if (!this.access.has('can_license_read') || establishments.length === 0) {
      this.licenseSummaries.set({});
      return;
    }
    this.isLoadingLicenses.set(true);
    forkJoin(establishments.map((establishment) => this.licenseService.list(establishment.id).pipe(
      map((licenses): [string, LicenseSummary | null] => [establishment.id, summarizeLicenses(licenses)]),
      catchError(() => of<[string, LicenseSummary | null]>([establishment.id, null]))
    ))).subscribe((entries) => {
      this.licenseSummaries.set(Object.fromEntries(entries));
      this.isLoadingLicenses.set(false);
    });
  }

  protected createEstablishment(request: OnboardEstablishmentRequest): void {
    if (!this.access.has('can_establishment_onboard') || this.isCreating()) return;

    this.createError.set(null);
    this.createSuccess.set(null);
    this.isCreating.set(true);
    this.establishmentService.create(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ establishment }) => {
        this.isCreating.set(false);
        this.creationOpen.set(false);
        this.establishments.update((items) => [establishment, ...items.filter((item) => item.id !== establishment.id)]);
        this.licenseSummaries.update((summaries) => ({ ...summaries, [establishment.id]: summarizeLicenses([]) }));
        this.startLicenseRegistration(establishment, this.creationTrigger);
      },
      error: (error: unknown) => {
        this.createError.set(this.getCreateErrorMessage(error));
        this.isCreating.set(false);
      }
    });
  }

  protected openCreationForm(event: Event): void {
    if (!this.access.has('can_establishment_onboard') || this.isCreating()) return;
    this.creationTrigger = event.currentTarget as HTMLElement;
    this.createError.set(null);
    this.licenseTarget.set(null);
    this.creationOpen.set(true);
  }

  protected closeCreationForm(): void {
    if (this.isCreating()) return;
    this.creationOpen.set(false);
  }

  protected clearFilters(): void {
    this.searchTerm.set('');
    this.selectedStatus.set('all');
  }

  protected startLicenseRegistration(establishment: Establishment, trigger: EventTarget | null = null): void {
    if (this.isRegisteringLicense()) return;
    this.creationOpen.set(false);
    this.licenseTrigger = trigger instanceof HTMLElement ? trigger : null;
    this.licenseTarget.set(establishment);
  }

  protected closeLicenseRegistration(): void {
    if (this.isRegisteringLicense()) return;
    this.licenseTarget.set(null);
    if (this.registrationMode) void this.router.navigate(['/establishments'], { replaceUrl: true });
  }

  protected onLicenseRegistered(establishment: Establishment): void {
    this.licenseTarget.set(null);
    this.createSuccess.set(`La licence de « ${establishment.name} » a été enregistrée.`);
    const openPortal = () => {
      void this.router.navigate(['/establishments', establishment.id], {
        state: { licenseRegistered: establishment.id }
      });
    };
    if (this.access.has('can_license_read')) {
      this.licenseAccess.refresh(establishment.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(openPortal);
    } else {
      openPortal();
    }
  }

  protected deactivateEstablishment(establishment: Establishment): void {
    if (!this.access.has('can_establishment_delete')) return;

    if (this.deactivatingId()) return;
    this.confirmation.confirm(`Désactiver l’établissement « ${establishment.name} » ? Son personnel et leurs comptes seront aussi désactivés.`, () => {

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
