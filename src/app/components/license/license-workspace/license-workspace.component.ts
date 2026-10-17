import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LicenseAccessService } from '../../../core/license-access.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { LicenseService } from '../../../service/license-service/license.service';
import { LicenseEvent, PlatformLicense } from '../../../models/license/license.model';
import { apiError } from '../../../shared/api-error';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { of, switchMap } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { EstablishmentService } from '../../../service/establishment-service/establishment.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';

@Component({
  selector: 'app-license-workspace',
  imports: [FormsModule, DatePipe],
  templateUrl: './license-workspace.component.html',
  styleUrl: './license-workspace.component.css'
})
export class LicenseWorkspaceComponent implements OnInit {
  protected readonly license = inject(LicenseAccessService);
  private readonly access = inject(WorkspaceAccessService);
  private readonly api = inject(LicenseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly establishments = inject(EstablishmentService);
  private readonly context = inject(WorkspaceContextService);
  protected readonly admin = computed(() => this.access.authorities().includes('ROLE_ADMIN'));
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly events = signal<LicenseEvent[] | null>(null);
  protected readonly eventLicense = signal<number | null>(null);
  protected readonly states = { ACTIVE: 'Active', UPCOMING: 'À venir', EXPIRED: 'Expirée', SUSPENDED: 'Suspendue' };
  protected offerId = '';
  protected validFrom = '';
  protected validUntil = '';

  ngOnInit(): void {
    if (!this.license.canRead()) return;
    this.route.paramMap.pipe(switchMap((params) => {
      const id = params.get('establishmentId');
      this.events.set(null);
      this.eventLicense.set(null);
      this.offerId = '';
      this.validFrom = '';
      this.validUntil = '';
      return this.establishments.getAccessible().pipe(switchMap((items) => {
        const establishment = items.find((item) => item.id === id);
        if (!establishment) throw new Error('Établissement inaccessible.');
        this.context.selectEstablishment(establishment);
        return of(null);
      }));
    }), takeUntilDestroyed(this.destroyRef)).subscribe({ error: (error) => this.error.set(apiError(error)) });
  }

  protected reload(): void {
    const id = this.license.establishmentId();
    if (id) this.license.refresh(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected assign(): void {
    const id = this.license.establishmentId();
    if (!id || !this.admin() || !this.offerId || this.busy()) return;
    const from = this.validFrom ? new Date(this.validFrom) : null;
    const until = this.validUntil ? new Date(this.validUntil) : null;
    if ((from && from.getTime() <= Date.now()) || (until && until.getTime() <= (from?.getTime() ?? Date.now()))) {
      this.error.set('La période doit commencer dans le futur et se terminer après son début. Laissez le début vide pour une attribution immédiate.');
      return;
    }
    this.run(id, this.api.assign(id, {
      offerId: this.offerId,
      ...(from ? { validFrom: from.toISOString() } : {}),
      ...(until ? { validUntil: until.toISOString() } : {})
    }));
  }

  protected transition(item: PlatformLicense, action: 'suspend' | 'reactivate' | 'end'): void {
    if (!this.admin() || this.busy() || !window.confirm('Confirmer cette modification de licence ?')) return;
    this.run(item.establishmentId, this.api.transition(item.establishmentId, item.id, action));
  }

  protected history(item: PlatformLicense): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.events.set(null);
    this.eventLicense.set(item.id);
    this.api.events(item.establishmentId, item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (events) => { this.events.set(events); this.busy.set(false); },
      error: (error) => { this.error.set(apiError(error)); this.busy.set(false); }
    });
  }

  private run(id: string, request: ReturnType<LicenseService['assign']>): void {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    request.pipe(switchMap(() => this.license.refresh(id)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.events.set(null);
        this.eventLicense.set(null);
        this.message.set(result ? 'Licence mise à jour.' : 'Modification enregistrée. La lecture des licences doit être réessayée.');
      },
      error: (error) => { this.busy.set(false); this.error.set(apiError(error)); }
    });
  }
}