import { ToastService } from '../../../service/toast-service/toast.service';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { EstablishmentRole } from '../../../models/role/role.model';
import { EmployeePosition } from '../../../models/position/position.model';
import { PositionService } from '../../../service/position-service/position.service';
import { RoleService } from '../../../service/role-service/role.service';
import { PositionFormComponent } from '../position-form/position-form.component';

@Component({
  selector: 'app-positions',
  imports: [FormModalComponent, PermissionDirective, FormsModule, PositionFormComponent],
  templateUrl: './position-list.component.html',
  styleUrl: './position-list.component.css'
})
export class PositionsComponent implements OnInit {
  private readonly toast = inject(ToastService);

  constructor() {
    this.toast.connect(this.successMessage, 'success');
    this.toast.connect(this.actionError, 'error');
  }

  private readonly confirmation = inject(ConfirmationDialogService);
  protected readonly access = inject(WorkspaceAccessService);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PositionService);
  private readonly roleService = inject(RoleService);

  protected readonly establishmentId = signal('');
  protected readonly positions = signal<EmployeePosition[]>([]);
  protected readonly roles = signal<EstablishmentRole[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLoadingRoles = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly isDeactivating = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly roleLoadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected editingName = '';
  protected editingRoleCodes: string[] = [];

  ngOnInit(): void {
    const establishmentRoute = this.route.parent ?? this.route;
    establishmentRoute.paramMap.subscribe((params) => {
      const establishmentId = params.get('establishmentId');
      if (!establishmentId) {
        this.errorMessage.set('Établissement introuvable.');
        this.isLoading.set(false);
        return;
      }
      this.establishmentId.set(establishmentId);
      this.load();
      this.loadRoles();
    });
  }

  protected loadRoles(): void {
    if (!this.access.hasPermission('can_role_read', this.establishmentId())) { this.isLoadingRoles.set(false); return; }
    this.isLoadingRoles.set(true);
    this.roleLoadError.set(null);
    this.roleService.getEstablishmentRoles(this.establishmentId()).subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.isLoadingRoles.set(false);
      },
      error: (error: unknown) => {
        this.roleLoadError.set(error instanceof HttpErrorResponse && error.status === 403
          ? 'Votre compte ne peut pas consulter les rôles de cet établissement.'
          : 'Impossible de charger les rôles disponibles. Réessayez.');
        this.isLoadingRoles.set(false);
      }
    });
  }

  protected assignableRoles(): EstablishmentRole[] {
    return this.roles().filter((role) => role.enabled && role.code !== 'ADMIN' && role.code !== 'PARENT');
  }

  protected load(): void {
    if (!this.access.hasPermission('can_position_read', this.establishmentId())) { this.isLoading.set(false); return; }
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.service.getPositions(this.establishmentId()).subscribe({
      next: (positions) => {
        this.positions.set(positions);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.errorFor(error));
        this.isLoading.set(false);
      }
    });
  }

  protected onPositionCreated(): void {
    this.successMessage.set('Le poste a été créé.');
    this.load();
  }

  protected startEditing(position: EmployeePosition): void {
    if (!this.access.hasAnyPermission(['can_position_update', 'can_position_assign_roles'], this.establishmentId())) return;
    this.successMessage.set(null);
    this.actionError.set(null);
    this.editingId.set(position.id);
    this.editingName = position.name;
    this.editingRoleCodes = [...position.roleCodes];
  }

  protected save(position: EmployeePosition): void {
    const name = this.editingName.trim();
    const nameChanged = name !== position.name;
    const rolesChanged = !this.sameRoles(this.editingRoleCodes, position.roleCodes);
    if ((nameChanged && !this.access.hasPermission('can_position_update', this.establishmentId())) || (rolesChanged && !this.access.hasPermission('can_position_assign_roles', this.establishmentId()))) return;
    if (!name || (!nameChanged && !rolesChanged) || this.isSaving()) return;
    this.actionError.set(null);
    this.isSaving.set(true);
    const updateName = nameChanged
      ? this.service.updatePosition(this.establishmentId(), position.id, { name })
      : of(position);
    updateName.pipe(
      switchMap(() => rolesChanged
        ? this.service.updatePositionRoles(this.establishmentId(), position.id, this.editingRoleCodes)
        : of(position))
    ).subscribe({
      next: () => this.finishSave(),
      error: (error: unknown) => this.failSave(error)
    });
  }

  protected requestDeactivation(position: EmployeePosition): void {
    if (!this.access.hasPermission('can_position_delete', this.establishmentId())) return;
    this.editingId.set(null);
    this.confirmation.confirm(`Désactiver le poste « ${position.name} » ? Les employés encore rattachés peuvent empêcher cette action.`, () => this.deactivate(position));
    this.actionError.set(null);
  }

  protected deactivate(position: EmployeePosition): void {
    if (!this.access.hasPermission('can_position_delete', this.establishmentId())) return;
    if (this.isDeactivating()) return;
    this.actionError.set(null);
    this.isDeactivating.set(true);
    this.service.deactivatePosition(this.establishmentId(), position.id).subscribe({
      next: () => {
            this.isDeactivating.set(false);
        this.successMessage.set(`Le poste « ${position.name} » a été désactivé.`);
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorFor(error));
        this.isDeactivating.set(false);
      }
    });
  }

  protected toggleRole(roleCode: string, event: Event): void {
    const selected = this.editingRoleCodes;
    const checked = (event.target as HTMLInputElement).checked;
    const updated = checked ? [...new Set([...selected, roleCode])] : selected.filter((item) => item !== roleCode);
    this.editingRoleCodes = updated;
  }

  protected cancel(): void {
    this.editingId.set(null);
    this.actionError.set(null);
  }

  protected roleLabel(roleCode: string): string {
    return this.roles().find((role) => role.code === roleCode)?.name
      ?? (roleCode === 'STAFF' ? 'Personnel' : roleCode === 'ESTABLISHMENT_ADMIN' ? 'Administrateur établissement' : roleCode);
  }

  private finishSave(): void {
    this.editingId.set(null);
    this.isSaving.set(false);
    this.successMessage.set('Le poste et ses rôles hérités ont été mis à jour.');
    this.load();
  }

  private failSave(error: unknown): void {
    this.actionError.set(this.errorFor(error));
    this.isSaving.set(false);
    this.load();
  }

  private sameRoles(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((role) => right.includes(role));
  }

  private errorFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire.';
      if (error.status === 404) return 'Le poste est introuvable ou inaccessible.';
      if (error.status === 409) return 'Le nom existe déjà ou des employés sont encore rattachés au poste.';
      if (error.status === 0) return 'Le serveur est inaccessible. Vérifiez la connexion puis réessayez.';
    }
    return 'L’opération n’a pas abouti. Réessayez.';
  }
}
