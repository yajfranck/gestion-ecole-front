import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  CopyTimetableRequest,
  TimetableDay,
  TimetableDayOfWeek,
  TimetableEntry,
  TimetableEntryRequest,
  TimetableNonWorkingDay,
  TimetableScope,
  TimetableWeek,
} from '../../models/timetable/timetable.model';

@Injectable({ providedIn: 'root' })
export class TimetableService {
  private readonly http = inject(HttpClient);
  list(scope: TimetableScope, dayOfWeek?: TimetableDayOfWeek) {
    return this.http.get<TimetableEntry[]>(this.url(scope), {
      params: dayOfWeek ? { dayOfWeek } : {},
    });
  }
  get(scope: TimetableScope, id: string) {
    return this.http.get<TimetableEntry>(`${this.url(scope)}/${id}`);
  }
  create(scope: TimetableScope, request: TimetableEntryRequest) {
    return this.http.post<TimetableEntry>(this.url(scope), request);
  }
  update(scope: TimetableScope, id: string, request: TimetableEntryRequest) {
    return this.http.put<TimetableEntry>(`${this.url(scope)}/${id}`, request);
  }
  archive(scope: TimetableScope, id: string) {
    return this.http.delete<void>(`${this.url(scope)}/${id}`);
  }
  day(scope: TimetableScope, date: string) {
    return this.http.get<TimetableDay>(`${this.url(scope)}/day`, { params: { date } });
  }
  week(scope: TimetableScope, date: string) {
    return this.http.get<TimetableWeek>(`${this.url(scope)}/week`, { params: { date } });
  }
  copy(scope: TimetableScope, request: CopyTimetableRequest) {
    return this.http.post<TimetableEntry[]>(`${this.url(scope)}/copy`, request);
  }
  nonWorkingDays(establishmentId: string, academicYearId: string) {
    return this.http.get<TimetableNonWorkingDay[]>(this.daysUrl(establishmentId, academicYearId));
  }
  replaceNonWorkingDays(
    establishmentId: string,
    academicYearId: string,
    days: TimetableNonWorkingDay[],
  ) {
    return this.http.put<TimetableNonWorkingDay[]>(this.daysUrl(establishmentId, academicYearId), {
      days,
    });
  }
  private daysUrl(establishmentId: string, academicYearId: string) {
    return `${environment.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/timetable/non-working-days`;
  }
  private url(scope: TimetableScope) {
    return `${environment.apiUrl}/establishments/${scope.establishmentId}/school-years/${scope.academicYearId}/classes/${scope.schoolClassId}/classrooms/${scope.classroomId}/timetable`;
  }
}
