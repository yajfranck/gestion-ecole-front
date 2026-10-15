import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AcademicYear } from '../../models/academic-year/academic-year.model';
import { SchoolClass } from '../../models/school-class/school-class.model';

@Injectable({ providedIn: 'root' })
export class AcademicYearService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getAcademicYears(establishmentId: string): Observable<AcademicYear[]> {
    return this.http.get<AcademicYear[]>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years`
    );
  }

  createAcademicYear(
    establishmentId: string,
    request: Pick<AcademicYear, 'name' | 'startsOn' | 'endsOn'>
  ): Observable<AcademicYear> {
    return this.http.post<AcademicYear>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years`,
      request
    );
  }

  getAcademicYear(establishmentId: string, academicYearId: string): Observable<AcademicYear> {
    return this.http.get<AcademicYear>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}`
    );
  }

  updateAcademicYear(
    establishmentId: string,
    academicYearId: string,
    request: Partial<Pick<AcademicYear, 'name' | 'startsOn' | 'endsOn'>>
  ): Observable<AcademicYear> {
    return this.http.patch<AcademicYear>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}`,
      request
    );
  }

  archiveAcademicYear(establishmentId: string, academicYearId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}`
    );
  }

  getClasses(establishmentId: string, academicYearId: string): Observable<SchoolClass[]> {
    return this.http.get<SchoolClass[]>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/classes`
    );
  }

  createClass(
    establishmentId: string,
    academicYearId: string,
    request: Pick<SchoolClass, 'code' | 'name'>
  ): Observable<SchoolClass> {
    return this.http.post<SchoolClass>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/classes`,
      request
    );
  }

  updateClass(
    establishmentId: string,
    academicYearId: string,
    schoolClassId: string,
    request: Pick<SchoolClass, 'code' | 'name'>
  ): Observable<SchoolClass> {
    return this.http.patch<SchoolClass>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/classes/${schoolClassId}`,
      request
    );
  }

  archiveClass(establishmentId: string, academicYearId: string, schoolClassId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/classes/${schoolClassId}`
    );
  }
}
