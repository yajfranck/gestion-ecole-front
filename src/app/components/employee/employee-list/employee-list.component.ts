import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
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
  imports: [FormsModule, EmployeeFormComponent, RouterLink],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.css'
})
export class EmployeeListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly employeeService = inject(EmployeeService);
  private readonly roleService = inject(EmployeeRoleService);
  private readonly positionService = inject(PositionService);

  protected readonly establishmentId = signal('');
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
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingRolesId = signal<string | null>(null);
  protected readonly confirmingId = signal<string | null>(null);

  protected searchTerm = '';
  protected employeeNumber = '';
  protected firstName = '';
  protected lastName = '';
  protected email = '';
  protected positionId = '';
  protected directRoleCodes: EmployeeRole[] = ['STAFF'];

  ngOnInit(): void {
    const establishmentRoute = this.route.parent ?? this.route;
    establishmentRoute.paramMap.subscribe((params) => {
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
    this.isLoading.set(true);
    this.employeeError.set(null);
    this.employeeService.getEmployees().subscribe({
      next: (employees) => { this.employees.set(employees); this.isLoading.set(false); },
      error: (error: unknown) => { this.employeeError.set(this.errorFor(error)); this.isLoading.set(false); }
    });
  }

  protected loadPositions(): void {
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

  protected onInvited(email: string): void {
    this.successMessage.set(`Invitation envoyée à ${email}.`);
    this.loadEmployees();
  }

  protected startEditing(employee: Employee): void {
    this.cancel();
    this.editingId.set(employee.id);
    this.employeeNumber = employee.employeeNumber;
    this.firstName = employee.firstName;
    this.lastName = employee.lastName;
    this.email = employee.email;
    this.positionId = employee.positionId;
  }

  protected saveEmployee(employee: Employee): void {
    const request = {
      employeeNumber: this.employeeNumber.trim(),
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      email: this.email.trim(),
      positionId: this.positionId
    };
    if (!request.employeeNumber || !request.firstName || !request.lastName || !request.email || !request.positionId || this.isSaving()) return;
    this.isSaving.set(true);
    this.actionError.set(null);
    this.employeeService.updateEmployee(employee.id, request).subscribe({
      next: () => {
        this.editingId.set(null);
        this.isSaving.set(false);
        this.successMessage.set('La fiche du membre du personnel a été mise à jour.');
        this.loadEmployees();
      },
      error: (error: unknown) => { this.actionError.set(this.errorFor(error)); this.isSaving.set(false); }
    });
  }

  protected startEditingRoles(employee: Employee): void {
    this.cancel();
    this.editingRolesId.set(employee.id);
    this.directRoleCodes = [...employee.directRoleCodes];
  }

  protected toggleRole(role: EmployeeRole, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.directRoleCodes = checked
      ? [...new Set([...this.directRoleCodes, role])]
      : this.directRoleCodes.filter((item) => item !== role);
  }

  protected saveRoles(employee: Employee): void {
    if (!this.directRoleCodes.length || this.isSaving()) return;
    this.isSaving.set(true);
    this.actionError.set(null);
    this.roleService.updateEmployeeRoles(employee.id, this.directRoleCodes).subscribe({
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
    this.cancel();
    this.confirmingId.set(employee.id);
  }

  protected deactivate(employee: Employee): void {
    if (this.isDeactivating()) return;
    this.isDeactivating.set(true);
    this.actionError.set(null);
    this.employeeService.deactivateEmployee(employee.id).subscribe({
      next: () => {
        this.confirmingId.set(null);
        this.isDeactivating.set(false);
        this.successMessage.set(`${employee.firstName} ${employee.lastName} a été désactivé.`);
        this.loadEmployees();
      },
      error: (error: unknown) => { this.actionError.set(this.errorFor(error)); this.isDeactivating.set(false); }
    });
  }

  protected cancel(): void {
    this.editingId.set(null);
    this.editingRolesId.set(null);
    this.confirmingId.set(null);
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