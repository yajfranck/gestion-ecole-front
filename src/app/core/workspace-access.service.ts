import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { EmployeeService } from '../service/employee-service/employee.service';
import { Employee } from '../models/employee/employee.model';

@Injectable({ providedIn: 'root' })
export class WorkspaceAccessService {
  private readonly auth = inject(AuthService);
  private readonly employees = inject(EmployeeService);
  private readonly employee = signal<Employee | null>(null);
  readonly authorities = computed<string[]>(() => {
    try {
      const payload = this.auth.session()?.accessToken.split('.')[1];
      if (!payload) return [];
      const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return Array.isArray(claims.authorities)
        ? claims.authorities.filter((value: unknown): value is string => typeof value === 'string') : [];
    } catch {
      return [];
    }
  });

  constructor() {
    effect((onCleanup) => {
      const authorities = this.authorities();
      this.employee.set(null);
      if (!authorities.some((value) => ['can_establishment_update', 'can_attendance_read', 'can_attendance_write'].includes(value))) return;
      const subscription = this.employees.getMe().subscribe({
        next: (employee) => this.employee.set(employee),
        error: () => this.employee.set(null)
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  canUpdateEstablishment(establishmentId: string): boolean {
    return this.authorities().includes('ROLE_ADMIN') || (
      this.hasPermission('can_establishment_update', establishmentId) &&
      this.employee()?.roles.includes('ESTABLISHMENT_ADMIN') === true
    );
  }

  hasPermission(permission: string, establishmentId: string): boolean {
    const employee = this.employee();
    return this.authorities().includes(permission) && employee?.enabled === true &&
      employee.loginEnabled && employee.establishmentId === establishmentId;
  }
}