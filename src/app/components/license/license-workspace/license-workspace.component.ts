import { ToastService } from '../../../service/toast-service/toast.service';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
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
import { Establishment } from '../../../models/establishment/establishment.model';
import { DialogComponent } from '../../../shared/dialog/dialog.component';
import { EstablishmentLicenseFormComponent } from '../../establishment/establishment-license-form/establishment-license-form.component';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';

@Component({
  selector: 'app-license-workspace',
  imports: [PermissionDirective, DatePipe, DialogComponent, EstablishmentLicenseFormComponent],
  templateUrl: './license-workspace.component.html',
  styleUrl: './license-workspace.component.css'
})
export class LicenseWorkspaceComponent implements OnInit {
  private readonly toast = inject(ToastService);

  constructor() {
    this.toast.connect(this.message, 'success');
    this.toast.connect(this.error, 'error');
  }

  private readonly confirmation = inject(ConfirmationDialogService);
  protected readonly license = inject(LicenseAccessService);
  protected readonly access = inject(WorkspaceAccessService);
  private readonly api = inject(LicenseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly establishments = inject(EstablishmentService);
  private readonly context = inject(WorkspaceContextService);
  protected readonly canAssign = computed(() => this.access.hasAllPermissions(['can_license_assign', 'can_license_offer_read']));
  protected readonly canManage = computed(() => ['can_license_assign', 'can_license_suspend', 'can_license_reactivate', 'can_license_end', 'can_license_event_read'].some((permission) => this.access.has(permission)));
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly events = signal<LicenseEvent[] | null>(null);
  protected readonly eventLicense = signal<number | null>(null);
  protected readonly states = { ACTIVE: 'Active', UPCOMING: 'À venir', EXPIRED: 'Expirée', SUSPENDED: 'Suspendue' };
  protected readonly assignmentOpen = signal(false);
  protected readonly establishment = signal<Establishment | null>(null);
  protected assignmentTrigger: HTMLElement | null = null;

  ngOnInit(): void {
    if (!this.license.canRead()) return;
    this.route.paramMap.pipe(switchMap((params) => {
      const id = params.get('establishmentId');
      this.events.set(null);
      this.eventLicense.set(null);
      this.assignmentOpen.set(false);
      this.establishment.set(null);
      if (!id) throw new Error('Établissement introuvable.');
      if (!this.access.has('can_establishment_read')) {
        this.establishment.set({ id, name: 'Établissement', code: '', enabled: true, createdAt: '', updatedAt: '' });
        this.context.selectEstablishment({ id, name: 'Établissement' });
        return of(null);
      }
      return this.establishments.getAccessible().pipe(switchMap((items) => {
        const establishment = items.find((item) => item.id === id);
        if (!establishment) throw new Error('Établissement inaccessible.');
        this.establishment.set(establishment);
        this.context.selectEstablishment(establishment);
        return of(null);
      }));
    }), takeUntilDestroyed(this.destroyRef)).subscribe({ error: (error) => this.error.set(apiError(error)) });
  }

  protected reload(): void {
    const id = this.license.establishmentId();
    if (id) this.license.refresh(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected openAssignment(event: Event): void {
    if (!this.canAssign() || this.busy() || !this.establishment()) return;
    this.assignmentTrigger = event.currentTarget as HTMLElement;
    this.assignmentOpen.set(true);
  }

  protected closeAssignment(): void {
    if (!this.busy()) this.assignmentOpen.set(false);
  }

  protected onAssigned(item: PlatformLicense): void {
    this.assignmentOpen.set(false);
    this.run(item.establishmentId, of(item));
  }

  protected transition(item: PlatformLicense, action: 'suspend' | 'reactivate' | 'end'): void {

    if (this.busy()) return;
    this.confirmation.confirm('Confirmer cette modification de licence ?', () => {
    this.run(item.establishmentId, this.api.transition(item.establishmentId, item.id, action));

    });
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