import { ToastService } from '../../../service/toast-service/toast.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Employee, UpdateEmployeeRequest } from '../../../models/employee/employee.model';
import { EmployeePosition } from '../../../models/position/position.model';
import { EmployeeService } from '../../../service/employee-service/employee.service';

@Component({
  selector: 'app-employee-form',
  imports: [PermissionDirective, FormsModule],
  templateUrl: './employee-form.component.html',
  styleUrl: './employee-form.component.css'
})
export class EmployeeFormComponent {
  private readonly toast = inject(ToastService);
  protected readonly access = inject(WorkspaceAccessService);
  private readonly service = inject(EmployeeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly establishmentId = input.required<string>();
  readonly positions = input<EmployeePosition[]>([]);
  readonly isLoadingPositions = input(false);
  readonly positionError = input<string | null>(null);
  readonly employee = input<Employee | null>(null);
  readonly saved = output<void>();
  readonly invited = output<string>();
  protected readonly permission = computed(() => this.employee() ? 'can_employee_update' : 'can_employee_create');
  protected readonly availablePositions = computed(() => this.positions().filter(position =>
    position.establishmentId === this.establishmentId() && (position.enabled || position.id === this.employee()?.positionId)));
  protected readonly hasCurrentPosition = computed(() => this.availablePositions().some(position => position.id === this.employee()?.positionId));
  readonly cancelled = output<void>();
  readonly busyChange = output<boolean>();

  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected employeeNumber = '';
  protected firstName = '';
  protected lastName = '';
  protected email = '';
  protected positionId = '';

  constructor() {
    this.toast.connect(this.errorMessage, 'error');
    effect(() => {
      const employee = this.employee();
      untracked(() => {
        this.employeeNumber = employee?.employeeNumber ?? '';
        this.firstName = employee?.firstName ?? '';
        this.lastName = employee?.lastName ?? '';
        this.email = employee?.email ?? '';
        this.positionId = employee?.positionId ?? '';
        this.errorMessage.set(null);
      });
    });
  }

  protected save(): void {
    const employee = this.employee();
    if (!this.access.hasPermission(this.permission(), this.establishmentId()) || this.isSaving()) return;
    if (employee && employee.establishmentId !== this.establishmentId()) return;
    if (!employee && (this.isLoadingPositions() || this.positionError())) return;
    const request = {
      employeeNumber: this.employeeNumber.trim(),
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      email: this.email.trim(),
      positionId: this.positionId
    };
    if (!request.employeeNumber || !request.firstName || !request.lastName || !request.email || !request.positionId) return;

    const changingPosition = !employee || request.positionId !== employee.positionId;
    if (changingPosition && !this.availablePositions().some(position => position.id === request.positionId && position.enabled)) return;

    this.errorMessage.set(null);
    this.isSaving.set(true);
    this.busyChange.emit(true);
    // Le PATCH permet de modifier l’identité sans réaffecter le poste actuel.
    const { positionId, ...identity } = request;
    const update: UpdateEmployeeRequest = { ...identity, ...(changingPosition ? { positionId } : {}) };
    const operation: Observable<unknown> = employee
      ? this.service.updateEmployee(this.establishmentId(), employee.id, update)
      : this.service.inviteEmployee(this.establishmentId(), request);
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.employeeNumber = '';
        this.firstName = '';
        this.lastName = '';
        this.email = '';
        this.positionId = '';
        this.isSaving.set(false);
        this.busyChange.emit(false);
        if (employee) this.saved.emit();
        else this.invited.emit(request.email);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.errorFor(error));
        this.isSaving.set(false);
        this.busyChange.emit(false);
      }
    });
  }

  private errorFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire.';
      if (error.status === 404) return 'La fiche ou le poste sélectionné est introuvable ou inaccessible.';
      if (error.status === 409) return 'Un membre possède déjà cet e-mail ou ce matricule.';
      if (error.status === 503 && !this.employee()) return 'Le service de courriel est indisponible, l’invitation n’a pas été envoyée.';
      if (error.status === 0) return 'Le serveur est inaccessible. Vérifiez la connexion puis réessayez.';
    }
    return this.employee()
      ? 'Impossible de modifier ce membre du personnel. Vos saisies sont conservées, vous pouvez réessayer.'
      : 'L’invitation n’a pas abouti. Vérifiez les informations puis réessayez.';
  }
}