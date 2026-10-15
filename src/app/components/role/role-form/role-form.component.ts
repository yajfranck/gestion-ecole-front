import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RolePermission } from '../../../models/permission/permission.model';
import { EstablishmentRole } from '../../../models/role/role.model';
import { PermissionService } from '../../../service/permission-service/permission.service';
import { RoleService } from '../../../service/role-service/role.service';
import { describePermission } from '../../permission/permission-list/permission-description';

@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.css'
})
export class RoleFormComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly roleService = inject(RoleService);

  readonly establishmentId = input.required<string>();
  readonly role = input<EstablishmentRole | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  protected readonly permissions = signal<RolePermission[]>([]);
  protected readonly selectedPermissionCodes = signal<string[]>([]);
  protected readonly permissionSearch = signal('');
  protected readonly isLoadingPermissions = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly permissionError = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected code = '';
  protected name = '';
  protected description = '';

  ngOnInit(): void {
    const role = this.role();
    this.code = role?.code ?? '';
    this.name = role?.name ?? '';
    this.description = role?.description ?? '';
    this.selectedPermissionCodes.set(role?.permissions.map((permission) => permission.code) ?? []);
    this.loadPermissions();
  }

  protected loadPermissions(): void {
    this.isLoadingPermissions.set(true);
    this.permissionError.set(null);
    this.permissionService.getAssignablePermissions(this.establishmentId()).subscribe({
      next: (permissions) => {
        this.permissions.set(permissions);
        this.isLoadingPermissions.set(false);
      },
      error: (error: unknown) => {
        this.permissionError.set(error instanceof HttpErrorResponse && error.status === 403
          ? 'Votre compte ne peut pas consulter le catalogue des permissions.'
          : 'Impossible de charger les permissions. Réessayez.');
        this.isLoadingPermissions.set(false);
      }
    });
  }

  protected togglePermission(code: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedPermissionCodes.update((selected) => checked
      ? [...new Set([...selected, code])]
      : selected.filter((permissionCode) => permissionCode !== code));
  }

  protected toggleDisplayedPermissions(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const displayedCodes = this.filteredPermissions().map((permission) => permission.code);
    if (checked) {
      this.selectedPermissionCodes.update((selected) => [...new Set([...selected, ...displayedCodes])]);
      return;
    }

    const removableCodes = new Set(displayedCodes.filter((code) =>
      !(this.role()?.code === 'ADMIN' && code === 'ADMIN_ACCESS')
    ));
    this.selectedPermissionCodes.update((selected) => selected.filter((code) => !removableCodes.has(code)));
  }

  protected areDisplayedPermissionsSelected(): boolean {
    const selected = new Set(this.selectedPermissionCodes());
    const displayed = this.filteredPermissions();
    return displayed.length > 0 && displayed.every((permission) => selected.has(permission.code));
  }

  protected areDisplayedPermissionsPartiallySelected(): boolean {
    const selected = new Set(this.selectedPermissionCodes());
    const displayed = this.filteredPermissions();
    const selectedCount = displayed.filter((permission) => selected.has(permission.code)).length;
    return selectedCount > 0 && selectedCount < displayed.length;
  }

  protected permissionDescription(permission: RolePermission): string {
    return describePermission(permission);
  }

  protected updatePermissionSearch(event: Event): void {
    this.permissionSearch.set((event.target as HTMLInputElement).value);
  }

  protected filteredPermissions(): RolePermission[] {
    const query = this.permissionSearch().trim().toLocaleLowerCase();
    if (!query) return this.permissions();

    return this.permissions().filter((permission) =>
      `${permission.code} ${this.permissionDescription(permission)}`.toLocaleLowerCase().includes(query)
    );
  }

  protected save(): void {
    const role = this.role();
    const code = this.code.trim();
    const name = this.name.trim();
    const permissionCodes = [...this.selectedPermissionCodes()];
    if (this.isSaving() || this.isLoadingPermissions() || this.permissionError() ||
        !name || (!role && !code) || permissionCodes.length === 0) return;

    this.errorMessage.set(null);
    this.isSaving.set(true);
    const request = {
      name,
      description: this.description.trim() || null,
      permissionCodes
    };
    const operation = role
      ? this.roleService.updateEstablishmentRole(this.establishmentId(), role.code, request)
      : this.roleService.createEstablishmentRole(this.establishmentId(), { code, ...request });
    operation.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saved.emit();
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.errorFor(error));
        this.isSaving.set(false);
      }
    });
  }

  private errorFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Le nom ou les permissions sont invalides. Vérifiez les champs puis réessayez.';
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire.';
      if (error.status === 404) return 'Ce rôle n’existe plus. Actualisez le catalogue puis réessayez.';
      if (error.status === 409) return 'Ce code de rôle est déjà utilisé.';
      if (error.status === 0) return 'Le serveur est inaccessible. Vérifiez la connexion puis réessayez.';
    }
    return 'L’enregistrement du rôle n’a pas abouti. Réessayez.';
  }
}