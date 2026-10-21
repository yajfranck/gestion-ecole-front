import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateEmployeeRequest,
  Employee,
  EmployeeInvitationResponse,
  AcceptEmployeeInvitationRequest,
  UpdateEmployeeRequest
} from '../../models/employee/employee.model';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getEmployees(establishmentId: string): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.apiUrl}/establishments/${establishmentId}/employees`);
  }

  getEmployee(establishmentId: string, employeeId: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.apiUrl}/establishments/${establishmentId}/employees/${employeeId}`);
  }

  getMe(establishmentId: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.apiUrl}/establishments/${establishmentId}/employees/me`);
  }

  inviteEmployee(establishmentId: string, request: CreateEmployeeRequest): Observable<EmployeeInvitationResponse> {
    return this.http.post<EmployeeInvitationResponse>(`${this.apiUrl}/establishments/${establishmentId}/employees`, request);
  }

  acceptInvitation(request: AcceptEmployeeInvitationRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/employees/invitations/accept`, request);
  }

  updateEmployee(establishmentId: string, employeeId: string, request: UpdateEmployeeRequest): Observable<Employee> {
    return this.http.patch<Employee>(`${this.apiUrl}/establishments/${establishmentId}/employees/${employeeId}`, request);
  }

  deactivateEmployee(establishmentId: string, employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/establishments/${establishmentId}/employees/${employeeId}`);
  }
}
