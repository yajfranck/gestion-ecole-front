import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { GuardianAttendanceHistory, GuardianChildSummary, GuardianPayment, GuardianTuitionFee } from '../../models/guardian/guardian-portal.model';

@Injectable({ providedIn: 'root' })
export class GuardianPortalService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/establishments`;

  summary(establishmentId: string, studentId: string, academicYearId: string) {
    return this.http.get<GuardianChildSummary>(`${this.base(establishmentId, studentId, academicYearId)}/summary`);
  }

  fees(establishmentId: string, studentId: string, yearId: string) {
    return this.http.get<GuardianTuitionFee[]>(`${this.base(establishmentId, studentId, yearId)}/tuition-fees`);
  }

  payments(establishmentId: string, studentId: string, yearId: string, chargeId: string, from: string, to: string) {
    return this.http.get<GuardianPayment[]>(`${this.base(establishmentId, studentId, yearId)}/tuition-fees/${chargeId}/payments`, { params: { from, to } });
  }

  attendance(establishmentId: string, studentId: string, yearId: string, from: string, to: string) {
    return this.http.get<GuardianAttendanceHistory>(`${this.base(establishmentId, studentId, yearId)}/attendance`, { params: { from, to } });
  }

  private base(establishmentId: string, studentId: string, yearId: string) {
    return `${this.api}/${establishmentId}/guardians/me/children/${studentId}/school-years/${yearId}`;
  }
}