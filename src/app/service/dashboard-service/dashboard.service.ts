import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable, throwError } from 'rxjs';
import { WorkspaceContextService } from '../../shared/workspace-context.service';
import { WorkspaceAccessService } from '../../core/workspace-access.service';
import { Dashboard } from '../../models/dashboard/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  private readonly context = inject(WorkspaceContextService);
  private readonly access = inject(WorkspaceAccessService);

  get(filters: { academicYearId?: string; date?: string } = {}): Observable<Dashboard> {
    const context = this.context.current();
    const yearId = filters.academicYearId || context?.academicYearId;
    if (context && yearId && this.access.hasPermission('can_dashboard_read', context.establishmentId)) {
      const params: Record<string, string> = filters.date ? { date: filters.date } : {};
      return this.http.get<Dashboard>(`${environment.apiUrl}/establishments/${context.establishmentId}/school-years/${yearId}/dashboard`, { params });
    }
    return this.access.hasPlatformPermission('can_dashboard_read')
      ? this.http.get<Dashboard>(`${environment.apiUrl}/dashboard`)
      : throwError(() => new Error('Sélectionnez un établissement et une année scolaire pour consulter le tableau de bord.'));
  }
}
