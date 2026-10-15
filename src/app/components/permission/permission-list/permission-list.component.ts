import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { RolePermission } from '../../../models/permission/permission.model';
import { EstablishmentRole } from '../../../models/role/role.model';
import { PermissionService } from '../../../service/permission-service/permission.service';
import { RoleService } from '../../../service/role-service/role.service';
import { describePermission } from './permission-description';

@Component({
  selector: 'app-permissions',
  templateUrl: './permission-list.component.html',
  styleUrl: './permission-list.component.css'
})
export class PermissionsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly permissionService = inject(PermissionService);
  private readonly roleService = inject(RoleService);
  protected readonly establishmentId = signal('');
  protected readonly permissions = signal<RolePermission[]>([]);
  protected readonly roles = signal<EstablishmentRole[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

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
    });
  }

  protected load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    forkJoin({
      permissions: this.permissionService.getAssignablePermissions(this.establishmentId()),
      roles: this.roleService.getEstablishmentRoles(this.establishmentId())
    }).subscribe({
      next: ({ permissions, roles }) => {
        this.permissions.set(permissions);
        this.roles.set(roles);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(error instanceof HttpErrorResponse && error.status === 403
          ? 'Votre compte ne peut pas consulter les permissions.'
          : 'Impossible de charger les permissions. Réessayez.');
        this.isLoading.set(false);
      }
    });
  }

  protected rolesFor(permissionCode: string): string[] {
    return this.roles()
      .filter((role) => role.permissions.some((permission) => permission.code === permissionCode))
      .map((role) => role.name);
  }

  protected descriptionFor(permission: RolePermission): string {
    return describePermission(permission);
  }
}