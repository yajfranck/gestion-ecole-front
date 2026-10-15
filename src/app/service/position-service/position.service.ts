import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EmployeePosition } from '../../models/position/position.model';

@Injectable({ providedIn: 'root' })
export class PositionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getPositions(establishmentId: string): Observable<EmployeePosition[]> {
    return this.http.get<EmployeePosition[]>(
      `${this.apiUrl}/establishments/${establishmentId}/positions`
    );
  }

  createPosition(
    establishmentId: string,
    request: { name: string; roleCodes?: string[] }
  ): Observable<EmployeePosition> {
    return this.http.post<EmployeePosition>(
      `${this.apiUrl}/establishments/${establishmentId}/positions`,
      request
    );
  }

  updatePosition(
    establishmentId: string,
    positionId: string,
    request: { name: string }
  ): Observable<EmployeePosition> {
    return this.http.patch<EmployeePosition>(
      `${this.apiUrl}/establishments/${establishmentId}/positions/${positionId}`,
      request
    );
  }

  updatePositionRoles(
    establishmentId: string,
    positionId: string,
    roleCodes: string[]
  ): Observable<EmployeePosition> {
    return this.http.put<EmployeePosition>(
      `${this.apiUrl}/establishments/${establishmentId}/positions/${positionId}/roles`,
      { roleCodes }
    );
  }

  deactivatePosition(establishmentId: string, positionId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/establishments/${establishmentId}/positions/${positionId}`
    );
  }
}
