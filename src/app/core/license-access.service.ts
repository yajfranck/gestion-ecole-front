import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, of, tap } from 'rxjs';
import { WorkspaceContextService } from '../shared/workspace-context.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { LicenseService } from '../service/license-service/license.service';
import { LicenseFeature, LicenseOffer, PlatformLicense } from '../models/license/license.model';

@Injectable({ providedIn: 'root' })
export class LicenseAccessService {
  private readonly api = inject(LicenseService);
  private readonly workspace = inject(WorkspaceContextService);
  private readonly access = inject(WorkspaceAccessService);
  readonly establishmentId = signal<string | null>(null);
  readonly licenses = signal<PlatformLicense[] | null>(null);
  readonly offers = signal<LicenseOffer[] | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly canRead = computed(() => this.access.authorities().some((authority) => ['ROLE_ADMIN', 'can_license_read'].includes(authority)));
  readonly active = computed(() => this.licenses()?.filter((license) => license.state === 'ACTIVE') ?? []);

  constructor() {
    effect((onCleanup) => {
      const id = this.workspace.current()?.establishmentId ?? null;
      const authorities = this.access.authorities();
      this.establishmentId.set(id);
      this.licenses.set(null);
      this.offers.set(null);
      this.error.set(null);
      this.notice.set(null);
      this.loading.set(false);
      if (!id || !authorities.some((authority) => ['ROLE_ADMIN', 'can_license_read'].includes(authority))) return;
      const subscription = this.refresh(id).subscribe();
      onCleanup(() => subscription.unsubscribe());
    });
  }

  refresh(id: string) {
    this.loading.set(true);
    this.notice.set(null);
    this.error.set(null);
    return forkJoin({
      licenses: this.api.list(id),
      offers: this.access.authorities().includes('ROLE_ADMIN')
        ? this.api.offers().pipe(catchError(() => of(null))) : of(null)
    }).pipe(tap({
      next: ({ licenses, offers }) => {
        if (this.establishmentId() !== id) return;
        this.licenses.set(licenses);
        this.offers.set(offers);
        this.loading.set(false);
      },
      error: () => {
        if (this.establishmentId() !== id) return;
        this.loading.set(false);
        this.error.set('Impossible de consulter les licences.');
      }
    }), catchError(() => of(null)));
  }

  decision(feature: LicenseFeature, id: string): 'allowed' | 'blocked' | 'unknown' {
    if (id !== this.establishmentId() || this.licenses() === null) return 'unknown';
    if (this.active().length === 0) return 'blocked';
    const offers = this.offers();
    if (!offers) return 'unknown';
    if (this.active().some((license) => !offers.some((offer) => offer.id === license.offerId))) return 'unknown';
    return this.active().some((license) => offers.find((offer) => offer.id === license.offerId)?.features.includes(feature))
      ? 'allowed' : 'blocked';
  }

  canUse(permission: string, feature: LicenseFeature, id: string): boolean {
    const authorities = this.access.authorities();
    const permitted = this.access.hasPermission(permission, id) ||
      (permission.startsWith('can_learning_content_') && authorities.includes('ADMIN_ACCESS') && authorities.includes(permission));
    return permitted && this.decision(feature, id) !== 'blocked';
  }
}