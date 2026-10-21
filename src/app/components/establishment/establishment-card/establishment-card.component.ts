import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { Establishment } from '../../../models/establishment/establishment.model';
import { LicenseSummary, LicenseSummaryStatus } from '../../../models/license/license-summary';
import { PermissionDirective } from '../../../shared/permission/permission.directive';

interface StatusView { label: string; classes: string; }

const STATUS_VIEWS: Record<LicenseSummaryStatus | 'UNKNOWN', StatusView> = {
  ACTIVE: { label: 'Licence active', classes: 'bg-[#e8f3ec] text-[#244a37] border-[#bcd8c6]' },
  UPCOMING: { label: 'Licence à venir', classes: 'bg-[#eaf1f8] text-[#2c4a6b] border-[#c3d5e8]' },
  EXPIRED: { label: 'Licence expirée', classes: 'bg-[#fbecea] text-[#8a3e2d] border-[#ecc4bb]' },
  SUSPENDED: { label: 'Licence suspendue', classes: 'bg-[#fdf3e1] text-[#8a672f] border-[#e6d3ad]' },
  NONE: { label: 'Licence non enregistrée', classes: 'bg-[#fdf3e1] text-[#8a672f] border-[#e6d3ad]' },
  UNKNOWN: { label: 'Licence non consultable', classes: 'bg-[#f1f4f0] text-[#69756d] border-[#e1e7e0]' }
};

@Component({
  selector: 'app-establishment-card',
  imports: [DatePipe, RouterLink, PermissionDirective],
  templateUrl: './establishment-card.component.html',
  styleUrl: './establishment-card.component.css'
})
export class EstablishmentCardComponent {
  private readonly access = inject(WorkspaceAccessService);

  readonly establishment = input.required<Establishment>();
  /** `null` : statut inconnu (permission absente, erreur ou chargement). */
  readonly summary = input<LicenseSummary | null>(null);
  readonly licenseLoading = input(false);
  readonly deactivating = input(false);
  readonly registerLicense = output<{ establishment: Establishment; trigger: HTMLElement }>();
  readonly deactivate = output<Establishment>();

  protected readonly status = computed<LicenseSummaryStatus | 'UNKNOWN'>(() => this.summary()?.status ?? 'UNKNOWN');
  protected readonly statusView = computed(() => STATUS_VIEWS[this.status()]);
  protected readonly needsLicense = computed(() => this.status() === 'NONE');
  protected readonly canRegisterLicense = computed(() =>
    this.needsLicense() && this.access.hasAllPermissions(['can_license_assign', 'can_license_offer_read']));
  protected register(event: Event): void {
    this.registerLicense.emit({ establishment: this.establishment(), trigger: event.currentTarget as HTMLElement });
  }
}
