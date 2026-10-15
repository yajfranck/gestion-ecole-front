import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { EnrollmentService } from './enrollment.service';

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/establishments/school-1/school-years/year-1/enrollments`;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EnrollmentService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('lists and creates enrollments for an establishment year', () => {
    service.getEnrollments('school-1', 'year-1').subscribe();
    http.expectOne(url).flush([]);
    service.createEnrollment('school-1', 'year-1', { studentId: 'student-1', schoolClassId: 'class-1' }).subscribe();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ studentId: 'student-1', schoolClassId: 'class-1' });
    request.flush({});
  });

  it('lists the students of a class', () => {
    service.getClassStudents('school-1', 'year-1', 'class-1').subscribe();
    http.expectOne(`${environment.apiUrl}/establishments/school-1/school-years/year-1/classes/class-1/students`).flush([]);
  });
});
