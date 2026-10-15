import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { SubjectService } from './subject.service';

describe('SubjectService', () => {
  let service: SubjectService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/establishments/school-1`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SubjectService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('manages subjects', () => {
    service.getSubjects('school-1').subscribe();
    http.expectOne(`${base}/subjects`).flush([]);
    service.getSubject('school-1', 's-1').subscribe();
    http.expectOne(`${base}/subjects/s-1`).flush({});
    service.createSubject('school-1', { code: 'MATH', name: 'Mathematics' }).subscribe();
    const create = http.expectOne(`${base}/subjects`);
    expect(create.request.method).toBe('POST');
    create.flush({});
    service.updateSubject('school-1', 's-1', { code: 'MATH', name: 'Maths' }).subscribe();
    const update = http.expectOne(`${base}/subjects/s-1`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ code: 'MATH', name: 'Maths' });
    update.flush({});
    service.archiveSubject('school-1', 's-1').subscribe();
    const archive = http.expectOne(`${base}/subjects/s-1`);
    expect(archive.request.method).toBe('DELETE');
    archive.flush(null);
  });

  it('assigns and unassigns a subject to a class', () => {
    const url = `${base}/school-years/year-1/classes/class-1/subjects`;
    service.getClassSubjects('school-1', 'year-1', 'class-1').subscribe();
    http.expectOne(url).flush([]);
    service.assignSubject('school-1', 'year-1', 'class-1', 's-1').subscribe();
    const assign = http.expectOne(`${url}/s-1`);
    expect(assign.request.method).toBe('PUT');
    assign.flush({});
    service.unassignSubject('school-1', 'year-1', 'class-1', 's-1').subscribe();
    const unassign = http.expectOne(`${url}/s-1`);
    expect(unassign.request.method).toBe('DELETE');
    unassign.flush(null);
  });
});
