import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AttendanceHistory, AttendanceInput, AttendanceSheet } from '../../models/attendance/attendance.model';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly http = inject(HttpClient);

  getSheet(establishmentId: string, academicYearId: string, schoolClassId: string, date: string, classroomId?: string) {
    return this.http.get<AttendanceSheet>(`${this.base(establishmentId, academicYearId)}/classes/${schoolClassId}/attendance`, {
      params: { date, ...(classroomId ? { classroomId } : {}) }
    });
  }

  save(establishmentId: string, academicYearId: string, schoolClassId: string, date: string, classroomId: string, entries: AttendanceInput[]) {
    return this.http.put<AttendanceSheet>(`${this.base(establishmentId, academicYearId)}/classes/${schoolClassId}/attendance/${date}`, { classroomId, entries });
  }

  getHistory(establishmentId: string, academicYearId: string, studentId: string, from: string, to: string) {
    return this.http.get<AttendanceHistory>(`${this.base(establishmentId, academicYearId)}/students/${studentId}/attendance`, { params: { from, to } });
  }

  private base(establishmentId: string, academicYearId: string): string {
    return `${environment.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}`;
  }
}