import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LucidePlus } from '@lucide/angular';
import { EstablishmentRole } from '../../../models/role/role.model';
import { RoleService } from '../../../service/role-service/role.service';
import { describePermission } from '../../permission/permission-list/permission-description';
import { RoleFormComponent } from '../role-form/role-form.component';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [RoleFormComponent, LucidePlus],
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.css'
})
export class RolesComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(RoleService);
  protected readonly establishmentId = signal('');
  protected readonly roles = signal<EstablishmentRole[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly isCreating = signal(false);
  protected readonly editingCode = signal<string | null>(null);

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
    this.service.getEstablishmentRoles(this.establishmentId()).subscribe({
      next: (roles) => { this.roles.set(roles); this.isLoading.set(false); },
      error: (error: unknown) => {
        this.errorMessage.set(error instanceof HttpErrorResponse && error.status === 403
          ? 'Votre compte ne peut pas consulter les rôles de cet établissement.'
          : 'Impossible de charger les rôles. Réessayez.');
        this.isLoading.set(false);
      }
    });
  }

  protected permissionDescription(permission: EstablishmentRole['permissions'][number]): string {
    return describePermission(permission);
  }

  protected startCreating(): void {
    this.editingCode.set(null);
    this.successMessage.set(null);
    this.isCreating.set(true);
  }

  protected startEditing(role: EstablishmentRole): void {
    if (!role.editable) return;
    this.isCreating.set(false);
    this.editingCode.set(role.code);
    this.successMessage.set(null);
  }

  protected cancelForm(): void {
    this.isCreating.set(false);
    this.editingCode.set(null);
  }

  protected onRoleSaved(): void {
    this.cancelForm();
    this.successMessage.set('Le rôle a été enregistré.');
    this.load();
  }
}