import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Dashboard } from '../../models/dashboard/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  get(filters: { academicYearId?: string; date?: string } = {}) {
    return this.http.get<Dashboard>(`${environment.apiUrl}/dashboard`, { params: filters });
  }
}
