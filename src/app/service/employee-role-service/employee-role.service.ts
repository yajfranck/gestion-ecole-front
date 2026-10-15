import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Employee } from '../../models/employee/employee.model';
import { EmployeeRole } from '../../models/role/role.model';

@Injectable({ providedIn: 'root' })
export class EmployeeRoleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  updateEmployeeRoles(employeeId: string, roleCodes: EmployeeRole[]): Observable<Employee> {
    return this.http.put<Employee>(`${this.apiUrl}/employees/${employeeId}/roles`, { roleCodes });
  }
}
