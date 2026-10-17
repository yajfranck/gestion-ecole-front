import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { GuardianAttendanceHistory, GuardianChildSummary, GuardianPayment, GuardianTuitionFee } from '../../models/guardian/guardian-portal.model';

@Injectable({ providedIn: 'root' })
export class GuardianPortalService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/guardians/me/children`;

  summary(studentId: string, academicYearId: string) {
    return this.http.get<GuardianChildSummary>(`${this.api}/${studentId}/summary`, { params: { academicYearId } });
  }

  fees(studentId: string, yearId: string) {
    return this.http.get<GuardianTuitionFee[]>(`${this.base(studentId, yearId)}/tuition-fees`);
  }

  payments(studentId: string, yearId: string, chargeId: string, from: string, to: string) {
    return this.http.get<GuardianPayment[]>(`${this.base(studentId, yearId)}/tuition-fees/${chargeId}/payments`, { params: { from, to } });
  }

  attendance(studentId: string, yearId: string, from: string, to: string) {
    return this.http.get<GuardianAttendanceHistory>(`${this.base(studentId, yearId)}/attendance`, { params: { from, to } });
  }

  private base(studentId: string, yearId: string) {
    return `${this.api}/${studentId}/school-years/${yearId}`;
  }
}