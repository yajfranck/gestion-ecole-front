import { ToastService } from '../../../service/toast-service/toast.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { effect, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EstablishmentRole } from '../../../models/role/role.model';
import { PositionService } from '../../../service/position-service/position.service';

@Component({
  selector: 'app-position-form',
  imports: [PermissionDirective, FormsModule],
  templateUrl: './position-form.component.html',
  styleUrl: './position-form.component.css'
})
export class PositionFormComponent {
  private readonly toast = inject(ToastService);

  constructor() {
    this.toast.connect(this.errorMessage, 'error');
  }

  readonly busyChange = output<boolean>();
  private readonly reportBusy = effect(() => this.busyChange.emit(this.isSaving()));
  protected readonly access = inject(WorkspaceAccessService);
  private readonly service = inject(PositionService);

  readonly establishmentId = input.required<string>();
  readonly roles = input<EstablishmentRole[]>([]);
  readonly isLoadingRoles = input(false);
  readonly roleLoadError = input<string | null>(null);
  readonly created = output<void>();

  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected name = '';
  protected roleCodes: string[] = ['STAFF'];

  protected assignableRoles(): EstablishmentRole[] {
    return this.roles().filter((role) => role.enabled && role.code !== 'ADMIN' && role.code !== 'PARENT');
  }

  protected toggleRole(roleCode: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.roleCodes = checked
      ? [...new Set([...this.roleCodes, roleCode])]
      : this.roleCodes.filter((item) => item !== roleCode);
  }

  protected create(): void {
    if (!this.access.hasPermission('can_position_create', this.establishmentId())) return;
    const name = this.name.trim();
    if (!name || this.isSaving()) return;

    this.errorMessage.set(null);
    this.isSaving.set(true);
    this.service.createPosition(this.establishmentId(), { name, roleCodes: this.access.hasPermission('can_role_read', this.establishmentId()) ? this.roleCodes : [] }).subscribe({
      next: () => {
        this.name = '';
        this.roleCodes = this.assignableRoles().some((role) => role.code === 'STAFF') ? ['STAFF'] : [];
        this.isSaving.set(false);
        this.created.emit();
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.errorFor(error));
        this.isSaving.set(false);
      }
    });
  }

  private errorFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire.';
      if (error.status === 409) return 'Un poste porte déjà ce nom dans cet établissement.';
      if (error.status === 0) return 'Le serveur est inaccessible. Vérifiez la connexion puis réessayez.';
    }
    return 'La création du poste n’a pas abouti. Vérifiez les informations puis réessayez.';
  }
}