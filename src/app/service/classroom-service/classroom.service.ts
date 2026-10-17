import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Classroom, ClassroomRequest } from '../../models/classroom/classroom.model';

@Injectable({ providedIn: 'root' })
export class ClassroomService {
  private readonly http = inject(HttpClient);

  list(establishmentId: string, yearId: string, classId: string) {
    return this.http.get<Classroom[]>(this.url(establishmentId, yearId, classId));
  }

  create(establishmentId: string, yearId: string, classId: string, request: ClassroomRequest) {
    return this.http.post<Classroom>(this.url(establishmentId, yearId, classId), request);
  }

  update(establishmentId: string, yearId: string, classId: string, id: string, request: Partial<ClassroomRequest>) {
    return this.http.patch<Classroom>(`${this.url(establishmentId, yearId, classId)}/${id}`, request);
  }

  archive(establishmentId: string, yearId: string, classId: string, id: string) {
    return this.http.delete<void>(`${this.url(establishmentId, yearId, classId)}/${id}`);
  }

  private url(establishmentId: string, yearId: string, classId: string) {
    return `${environment.apiUrl}/establishments/${establishmentId}/school-years/${yearId}/classes/${classId}/classrooms`;
  }
}
