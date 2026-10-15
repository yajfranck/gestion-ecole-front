import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateRoleRequest,
  EstablishmentRole,
  SecurityRole,
  UpdateRoleRequest
} from '../../models/role/role.model';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);

  getRoles(): Observable<SecurityRole[]> {
    return this.http.get<SecurityRole[]>(`${environment.apiUrl}/role`);
  }

  getEstablishmentRoles(establishmentId: string): Observable<EstablishmentRole[]> {
    return this.http.get<EstablishmentRole[]>(
      `${environment.apiUrl}/establishments/${establishmentId}/roles`
    );
  }

  createEstablishmentRole(establishmentId: string, request: CreateRoleRequest): Observable<EstablishmentRole> {
    return this.http.post<EstablishmentRole>(
      `${environment.apiUrl}/establishments/${establishmentId}/roles`,
      request
    );
  }

  updateEstablishmentRole(
    establishmentId: string,
    code: string,
    request: UpdateRoleRequest
  ): Observable<EstablishmentRole> {
    return this.http.put<EstablishmentRole>(
      `${environment.apiUrl}/establishments/${establishmentId}/roles/${encodeURIComponent(code)}`,
      request
    );
  }

  createRole(request: CreateRoleRequest): Observable<SecurityRole> {
    return this.http.post<SecurityRole>(`${environment.apiUrl}/role`, request);
  }

  updateRole(code: string, request: UpdateRoleRequest): Observable<SecurityRole> {
    return this.http.put<SecurityRole>(`${environment.apiUrl}/role/${encodeURIComponent(code)}`, request);
  }
}
