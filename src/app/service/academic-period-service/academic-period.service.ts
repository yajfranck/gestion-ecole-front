import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AcademicPeriod, AcademicPeriodRequest } from '../../models/academic-period/academic-period.model';

@Injectable({ providedIn: 'root' })
export class AcademicPeriodService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getPeriods(establishmentId: string, academicYearId: string): Observable<AcademicPeriod[]> {
    return this.http.get<AcademicPeriod[]>(this.url(establishmentId, academicYearId));
  }

  createPeriod(establishmentId: string, academicYearId: string, request: AcademicPeriodRequest): Observable<AcademicPeriod> {
    return this.http.post<AcademicPeriod>(this.url(establishmentId, academicYearId), request);
  }

  updatePeriod(
    establishmentId: string,
    academicYearId: string,
    periodId: string,
    request: Partial<AcademicPeriodRequest>
  ): Observable<AcademicPeriod> {
    return this.http.patch<AcademicPeriod>(`${this.url(establishmentId, academicYearId)}/${periodId}`, request);
  }

  archivePeriod(establishmentId: string, academicYearId: string, periodId: string): Observable<void> {
    return this.http.delete<void>(`${this.url(establishmentId, academicYearId)}/${periodId}`);
  }

  private url(establishmentId: string, academicYearId: string): string {
    return `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/periods`;
  }
}
