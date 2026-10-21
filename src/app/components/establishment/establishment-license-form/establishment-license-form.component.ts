import { ToastService } from '../../../service/toast-service/toast.service';
import { Component, computed, effect, DestroyRef, inject, input, output, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, of, switchMap } from 'rxjs';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { Establishment } from '../../../models/establishment/establishment.model';
import { LicenseOffer, PlatformLicense } from '../../../models/license/license.model';
import { findBlockingLicense } from '../../../models/license/license-summary';
import { LicenseService } from '../../../service/license-service/license.service';

@Component({
  selector: 'app-establishment-license-form',
  imports: [FormsModule],
  templateUrl: './establishment-license-form.component.html',
  styleUrl: './establishment-license-form.component.css'
})
export class EstablishmentLicenseFormComponent {
  private readonly toast = inject(ToastService);
  private readonly access = inject(WorkspaceAccessService);
  private readonly licenseService = inject(LicenseService);
  private readonly destroyRef = inject(DestroyRef);

  readonly establishment = input.required<Establishment>();
  readonly registered = output<PlatformLicense>();
  readonly cancelled = output<void>();
  readonly busyChange = output<boolean>();
  readonly allowReplacement = input(false);

  protected readonly validEstablishment = computed(() => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.establishment().id));
  protected readonly canAssign = computed(() => this.access.hasAllPermissions(['can_license_assign', 'can_license_offer_read']));
  protected readonly offers = signal<LicenseOffer[] | null>(null);
  protected readonly isLoadingOffers = signal(false);
  protected readonly offersError = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly isSaving = signal(false);
  protected offerId = '';
  protected validFrom = '';
  protected validUntil = '';

  constructor() {
    this.toast.connect(this.error, 'error');
    effect(() => {
      this.establishment();
      untracked(() => {
        this.error.set(null);
        this.offerId = '';
        this.validFrom = '';
        this.validUntil = '';
      });
    });
    if (this.canAssign()) this.loadOffers();
  }

  protected loadOffers(): void {
    this.offersError.set(null);
    this.isLoadingOffers.set(true);
    this.licenseService.offers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (offers) => {
        this.offers.set(offers.filter((offer) => offer.enabled));
        this.isLoadingOffers.set(false);
      },
      error: (error: unknown) => {
        this.offersError.set(error instanceof HttpErrorResponse && error.status === 403
          ? 'Votre compte ne peut pas consulter les offres de licence.'
          : 'Impossible de charger les offres. Réessayez.');
        this.isLoadingOffers.set(false);
      }
    });
  }

  protected register(): void {
    const establishment = this.establishment();
    if (this.isSaving()) return;
    if (!this.validEstablishment()) {
      this.error.set('L’établissement est absent ou invalide. Reprenez l’enregistrement depuis le portail.');
      return;
    }
    if (!this.canAssign() || this.isLoadingOffers() || !this.offers()?.some((offer) => offer.id === this.offerId)) return;

    const validFrom = this.validFrom ? new Date(this.validFrom) : null;
    const validUntil = this.validUntil ? new Date(this.validUntil) : null;
    if ((validFrom && (!Number.isFinite(validFrom.getTime()) || validFrom.getTime() <= Date.now())) ||
        (validUntil && (!Number.isFinite(validUntil.getTime()) || validUntil.getTime() <= (validFrom?.getTime() ?? Date.now())))) {
      this.error.set('La période doit commencer dans le futur et se terminer après son début. Laissez le début vide pour une attribution immédiate.');
      return;
    }

    const request = {
      offerId: this.offerId,
      ...(validFrom ? { validFrom: validFrom.toISOString() } : {}),
      ...(validUntil ? { validUntil: validUntil.toISOString() } : {})
    };
    this.error.set(null);
    this.isSaving.set(true);
    this.busyChange.emit(true);
    // Relit les licences avant d'écrire pour ne jamais créer de doublon après un nouvel essai.
    const existing$ = !this.allowReplacement() && this.access.has('can_license_read')
      ? this.licenseService.list(establishment.id).pipe(catchError(() => of(null)))
      : of(null);
    existing$.pipe(switchMap((licenses) => {
      const current = licenses ? findBlockingLicense(licenses) : undefined;
      return current ? of(current) : this.licenseService.assign(establishment.id, request);
    }), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (license) => {
        this.isSaving.set(false);
        this.busyChange.emit(false);
        this.registered.emit(license);
      },
      error: (error: unknown) => {
        this.error.set(this.errorMessage(error));
        this.isSaving.set(false);
        this.busyChange.emit(false);
      }
    });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'La période de licence est invalide. Vérifiez les dates puis réessayez.';
      if (error.status === 403) return 'Votre compte n’est pas autorisé à enregistrer cette licence.';
      if (error.status === 404) return 'L’offre sélectionnée ou l’établissement est introuvable.';
      if (error.status === 409) return 'Cette période entre en conflit avec une autre licence. Modifiez les dates puis réessayez.';
    }
    return 'Impossible d’enregistrer la licence. Vos choix sont conservés, vous pouvez réessayer.';
  }
}
