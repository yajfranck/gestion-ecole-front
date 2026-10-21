import { ToastService } from '../../../service/toast-service/toast.service';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogComponent } from '../../../shared/dialog/dialog.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Employee } from '../../../models/employee/employee.model';
import { EmployeeRole } from '../../../models/role/role.model';
import { EmployeePosition } from '../../../models/position/position.model';
import { EmployeeRoleService } from '../../../service/employee-role-service/employee-role.service';
import { EmployeeService } from '../../../service/employee-service/employee.service';
import { PositionService } from '../../../service/position-service/position.service';
import { EmployeeFormComponent } from '../employee-form/employee-form.component';

@Component({
  selector: 'app-employee-list',
  imports: [FormModalComponent, DialogComponent, PermissionDirective, FormsModule, EmployeeFormComponent, RouterLink],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.css'
})
export class EmployeeListComponent implements OnInit {
  private readonly toast = inject(ToastService);

  constructor() {
    this.toast.connect(this.successMessage, 'success');
    this.toast.connect(this.actionError, 'error');
  }

  private readonly confirmation = inject(ConfirmationDialogService);
  protected readonly access = inject(WorkspaceAccessService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly employeeService = inject(EmployeeService);
  private readonly roleService = inject(EmployeeRoleService);
  private readonly positionService = inject(PositionService);

  protected readonly establishmentId = signal('');
  protected readonly invitationOpen = signal(false);
  protected readonly isInviting = signal(false);
  protected invitationTrigger: HTMLElement | null = null;
  protected readonly employees = signal<Employee[]>([]);
  protected readonly positions = signal<EmployeePosition[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isLoadingPositions = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly isDeactivating = signal(false);
  protected readonly employeeError = signal<string | null>(null);
  protected readonly positionError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly editingEmployee = signal<Employee | null>(null);
  protected readonly isUpdatingEmployee = signal(false);
  protected editTrigger: HTMLElement | null = null;
  protected readonly editingRolesId = signal<string | null>(null);

  protected searchTerm = '';
  protected directRoleCodes: EmployeeRole[] = ['STAFF'];

  ngOnInit(): void {
    const establishmentRoute = this.route.parent ?? this.route;
    establishmentRoute.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.invitationOpen.set(false);
      this.isInviting.set(false);
      this.editingEmployee.set(null);
      this.isUpdatingEmployee.set(false);
      const establishmentId = params.get('establishmentId');
      if (!establishmentId) {
        this.employeeError.set('Établissement introuvable.');
        this.isLoading.set(false);
        this.isLoadingPositions.set(false);
        return;
      }
      this.establishmentId.set(establishmentId);
      this.loadEmployees();
      this.loadPositions();
    });
  }

  protected filteredEmployees(): Employee[] {
    const query = this.searchTerm.trim().toLocaleLowerCase('fr');
    return this.employees()
      .filter((employee) => employee.establishmentId === this.establishmentId())
      .filter((employee) => !query || [employee.firstName, employee.lastName, employee.employeeNumber, employee.email]
        .some((value) => value.toLocaleLowerCase('fr').includes(query)));
  }

  protected activePositions(): EmployeePosition[] {
    return this.positions().filter((position) => position.enabled);
  }

  protected loadEmployees(): void {
    if (!this.access.hasPermission('can_employee_read', this.establishmentId())) { this.isLoading.set(false); return; }
    this.isLoading.set(true);
    this.employeeError.set(null);
    this.employeeService.getEmployees(this.establishmentId()).subscribe({
      next: (employees) => { this.employees.set(employees); this.isLoading.set(false); },
      error: (error: unknown) => { this.employeeError.set(this.errorFor(error)); this.isLoading.set(false); }
    });
  }

  protected loadPositions(): void {
    if (!this.access.hasPermission('can_position_read', this.establishmentId())) { this.isLoadingPositions.set(false); return; }
    this.isLoadingPositions.set(true);
    this.positionError.set(null);
    this.positionService.getPositions(this.establishmentId()).subscribe({
      next: (positions) => {
        this.positions.set(positions);
        this.isLoadingPositions.set(false);
      },
      error: (error: unknown) => { this.positionError.set(this.errorFor(error)); this.isLoadingPositions.set(false); }
    });
  }

  protected openInvitation(event: Event): void {
    if (!this.access.hasPermission('can_employee_create', this.establishmentId()) || this.isInviting()) return;
    this.successMessage.set(null);
    this.invitationTrigger = event.currentTarget as HTMLElement;
    this.invitationOpen.set(true);
  }

  protected closeInvitation(): void {
    if (!this.isInviting()) this.invitationOpen.set(false);
  }

  protected onInvited(email: string): void {
    this.invitationOpen.set(false);
    this.successMessage.set(`Invitation envoyée à ${email}.`);
    this.loadEmployees();
  }

  protected startEditing(employee: Employee, event: Event): void {
    if (!this.access.hasPermission('can_employee_update', this.establishmentId()) || this.isUpdatingEmployee()) return;
    this.successMessage.set(null);
    this.cancel();
    this.editTrigger = event.currentTarget as HTMLElement;
    this.editingEmployee.set(employee);
  }

  protected closeEmployeeEdit(): void {
    if (!this.isUpdatingEmployee()) this.editingEmployee.set(null);
  }

  protected onEmployeeSaved(): void {
    this.editingEmployee.set(null);
    this.successMessage.set('La fiche du membre du personnel a été mise à jour.');
    this.loadEmployees();
  }

  protected startEditingRoles(employee: Employee): void {
    if (!this.access.hasPermission('can_employee_assign_roles', this.establishmentId())) return;
    this.successMessage.set(null);
    this.cancel();
    this.editingRolesId.set(employee.id);
    this.directRoleCodes = [...employee.directRoleCodes];
  }

  protected toggleRole(role: EmployeeRole, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (role === 'ESTABLISHMENT_ADMIN' && checked && !this.access.has('can_employee_assign_administrator')) return;
    this.directRoleCodes = checked
      ? [...new Set([...this.directRoleCodes, role])]
      : this.directRoleCodes.filter((item) => item !== role);
  }

  protected saveRoles(employee: Employee): void {
    if (!this.access.hasPermission('can_employee_assign_roles', this.establishmentId())) return;
    if (!this.directRoleCodes.length || this.isSaving()) return;
    this.isSaving.set(true);
    this.actionError.set(null);
    this.roleService.updateEmployeeRoles(this.establishmentId(), employee.id, this.directRoleCodes).subscribe({
      next: () => {
        this.editingRolesId.set(null);
        this.isSaving.set(false);
        this.successMessage.set('Les rôles directs ont été mis à jour.');
        this.loadEmployees();
      },
      error: (error: unknown) => { this.actionError.set(this.errorFor(error)); this.isSaving.set(false); }
    });
  }

  protected confirmDeactivation(employee: Employee): void {
    if (!this.access.hasPermission('can_employee_delete', this.establishmentId())) return;
    this.cancel();
    this.confirmation.confirm(`Désactiver le compte de ${employee.firstName} ${employee.lastName} ?`, () => this.deactivate(employee));
  }

  protected deactivate(employee: Employee): void {
    if (!this.access.hasPermission('can_employee_delete', this.establishmentId())) return;
    if (this.isDeactivating()) return;
    this.isDeactivating.set(true);
    this.actionError.set(null);
    this.employeeService.deactivateEmployee(this.establishmentId(), employee.id).subscribe({
      next: () => {
            this.isDeactivating.set(false);
        this.successMessage.set(`${employee.firstName} ${employee.lastName} a été désactivé.`);
        this.loadEmployees();
      },
      error: (error: unknown) => { this.actionError.set(this.errorFor(error)); this.isDeactivating.set(false); }
    });
  }

  protected cancel(): void {
    this.closeEmployeeEdit();
    this.editingRolesId.set(null);
  }

  protected roleLabel(role: EmployeeRole): string {
    return role === 'ESTABLISHMENT_ADMIN' ? 'Administrateur établissement' : 'Personnel';
  }

  private errorFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire.';
      if (error.status === 404) return 'La fiche ou le poste est introuvable ou inaccessible.';
      if (error.status === 409) return 'Un membre du personnel possède déjà cet e-mail ou ce matricule.';
      if (error.status === 503) return 'Le service de courriel est indisponible, l’invitation n’a pas été envoyée.';
      if (error.status === 0) return 'Le serveur est inaccessible. Vérifiez la connexion puis réessayez.';
    }
    return 'L’opération n’a pas abouti. Vérifiez les informations puis réessayez.';
  }
}
