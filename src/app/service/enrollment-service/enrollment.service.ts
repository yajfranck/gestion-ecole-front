import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClassStudent, Enrollment } from '../../models/enrollment/enrollment.model';

@Injectable({ providedIn: 'root' })
export class EnrollmentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getEnrollments(establishmentId: string, academicYearId: string): Observable<Enrollment[]> {
    return this.http.get<Enrollment[]>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/enrollments`
    );
  }

  getClassStudents(establishmentId: string, academicYearId: string, schoolClassId: string): Observable<ClassStudent[]> {
    return this.http.get<ClassStudent[]>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/classes/${schoolClassId}/students`
    );
  }

  createEnrollment(
    establishmentId: string,
    academicYearId: string,
    request: Pick<Enrollment, 'studentId' | 'schoolClassId'>
  ): Observable<Enrollment> {
    return this.http.post<Enrollment>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/enrollments`,
      request
    );
  }
}
