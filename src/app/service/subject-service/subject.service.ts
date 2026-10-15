import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SchoolClassSubject, Subject, SubjectRequest } from '../../models/subject/subject.model';

@Injectable({ providedIn: 'root' })
export class SubjectService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getSubjects(establishmentId: string): Observable<Subject[]> {
    return this.http.get<Subject[]>(this.subjectsUrl(establishmentId));
  }

  getSubject(establishmentId: string, subjectId: string): Observable<Subject> {
    return this.http.get<Subject>(`${this.subjectsUrl(establishmentId)}/${subjectId}`);
  }

  createSubject(establishmentId: string, request: SubjectRequest): Observable<Subject> {
    return this.http.post<Subject>(this.subjectsUrl(establishmentId), request);
  }

  updateSubject(establishmentId: string, subjectId: string, request: SubjectRequest): Observable<Subject> {
    return this.http.patch<Subject>(`${this.subjectsUrl(establishmentId)}/${subjectId}`, request);
  }

  archiveSubject(establishmentId: string, subjectId: string): Observable<void> {
    return this.http.delete<void>(`${this.subjectsUrl(establishmentId)}/${subjectId}`);
  }

  getClassSubjects(establishmentId: string, academicYearId: string, schoolClassId: string): Observable<SchoolClassSubject[]> {
    return this.http.get<SchoolClassSubject[]>(this.classSubjectsUrl(establishmentId, academicYearId, schoolClassId));
  }

  assignSubject(
    establishmentId: string,
    academicYearId: string,
    schoolClassId: string,
    subjectId: string
  ): Observable<SchoolClassSubject> {
    return this.http.put<SchoolClassSubject>(
      `${this.classSubjectsUrl(establishmentId, academicYearId, schoolClassId)}/${subjectId}`,
      null
    );
  }

  unassignSubject(
    establishmentId: string,
    academicYearId: string,
    schoolClassId: string,
    subjectId: string
  ): Observable<void> {
    return this.http.delete<void>(`${this.classSubjectsUrl(establishmentId, academicYearId, schoolClassId)}/${subjectId}`);
  }

  private subjectsUrl(establishmentId: string): string {
    return `${this.apiUrl}/establishments/${establishmentId}/subjects`;
  }

  private classSubjectsUrl(establishmentId: string, academicYearId: string, schoolClassId: string): string {
    return `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/classes/${schoolClassId}/subjects`;
  }
}
