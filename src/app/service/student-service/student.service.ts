import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Student } from '../../models/student/student.model';

@Injectable({ providedIn: 'root' })
export class StudentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getStudents(establishmentId: string): Observable<Student[]> {
    return this.http.get<Student[]>(
      `${this.apiUrl}/establishments/${establishmentId}/students`
    );
  }

  createStudent(
    establishmentId: string,
    request: Pick<Student, 'firstName' | 'lastName'>
  ): Observable<Student> {
    return this.http.post<Student>(
      `${this.apiUrl}/establishments/${establishmentId}/students`,
      request
    );
  }

  updateStudent(
    establishmentId: string,
    studentId: string,
    request: Partial<Pick<Student, 'firstName' | 'lastName'>>
  ): Observable<Student> {
    return this.http.patch<Student>(
      `${this.apiUrl}/establishments/${establishmentId}/students/${studentId}`,
      request
    );
  }

  getStudent(establishmentId: string, studentId: string): Observable<Student> {
    return this.http.get<Student>(
      `${this.apiUrl}/establishments/${establishmentId}/students/${studentId}`
    );
  }

  archiveStudent(establishmentId: string, studentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/establishments/${establishmentId}/students/${studentId}`
    );
  }
}
