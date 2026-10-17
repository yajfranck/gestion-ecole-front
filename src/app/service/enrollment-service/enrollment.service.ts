import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClassStudent, CreateEnrollmentRequest, Enrollment, EnrollmentCreation } from '../../models/enrollment/enrollment.model';

@Injectable({ providedIn: 'root' })
export class EnrollmentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getEnrollments(establishmentId: string, academicYearId: string): Observable<Enrollment[]> {
    return this.http.get<Enrollment[]>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/enrollments`
    );
  }

  getClassStudents(establishmentId: string, academicYearId: string, schoolClassId: string, classroomId?: string): Observable<ClassStudent[]> {
    return this.http.get<ClassStudent[]>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/classes/${schoolClassId}/students`,
      { params: classroomId ? { classroomId } : {} }
    );
  }

  createEnrollment(
    establishmentId: string,
    academicYearId: string,
    request: CreateEnrollmentRequest
  ): Observable<EnrollmentCreation> {
    return this.http.post<EnrollmentCreation>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/enrollments`,
      request
    );
  }

  changeClassroom(establishmentId: string, academicYearId: string, enrollmentId: string, classroomId: string): Observable<Enrollment> {
    return this.http.patch<Enrollment>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/enrollments/${enrollmentId}`, { classroomId }
    );
  }
}
