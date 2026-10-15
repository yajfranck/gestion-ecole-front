import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RolePermission } from '../../models/permission/permission.model';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly http = inject(HttpClient);

  getPermissions(): Observable<RolePermission[]> {
    return this.http.get<RolePermission[]>(`${environment.apiUrl}/permission`);
  }

  getAssignablePermissions(establishmentId: string): Observable<RolePermission[]> {
    return this.http.get<RolePermission[]>(
      `${environment.apiUrl}/establishments/${establishmentId}/permissions`
    );
  }
}
