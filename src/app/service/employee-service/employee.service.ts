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

  getEmployees(): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.apiUrl}/employees`);
  }

  getEmployee(employeeId: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.apiUrl}/employees/${employeeId}`);
  }

  getMe(): Observable<Employee> {
    return this.http.get<Employee>(`${this.apiUrl}/employees/me`);
  }

  inviteEmployee(request: CreateEmployeeRequest): Observable<EmployeeInvitationResponse> {
    return this.http.post<EmployeeInvitationResponse>(`${this.apiUrl}/employees`, request);
  }

  acceptInvitation(request: AcceptEmployeeInvitationRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/employees/invitations/accept`, request);
  }

  updateEmployee(employeeId: string, request: UpdateEmployeeRequest): Observable<Employee> {
    return this.http.patch<Employee>(`${this.apiUrl}/employees/${employeeId}`, request);
  }

  deactivateEmployee(employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/employees/${employeeId}`);
  }
}
