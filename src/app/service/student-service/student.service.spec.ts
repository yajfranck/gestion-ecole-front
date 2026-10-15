import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { StudentService } from './student.service';

describe('StudentService', () => {
  let service: StudentService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/establishments/school-1/students`;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(StudentService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('lists and creates students within an establishment', () => {
    service.getStudents('school-1').subscribe();
    http.expectOne(url).flush([]);
    service.createStudent('school-1', { firstName: 'Ada', lastName: 'Lovelace' }).subscribe();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    request.flush({});
  });

  it('updates student names and archives a student', () => {
    service.updateStudent('school-1', 'student-1', { firstName: 'Augusta' }).subscribe();
    const updateRequest = http.expectOne(`${url}/student-1`);
    expect(updateRequest.request.method).toBe('PATCH');
    expect(updateRequest.request.body).toEqual({ firstName: 'Augusta' });
    updateRequest.flush({ id: 'student-1', firstName: 'Augusta' });

    service.archiveStudent('school-1', 'student-1').subscribe();
    const archiveRequest = http.expectOne(`${url}/student-1`);
    expect(archiveRequest.request.method).toBe('DELETE');
    archiveRequest.flush(null, { status: 204, statusText: 'No Content' });
  });
});
