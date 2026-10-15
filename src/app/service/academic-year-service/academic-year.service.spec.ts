import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AcademicYearService } from './academic-year.service';

describe('AcademicYearService', () => {
  let service: AcademicYearService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/establishments/school-1`;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AcademicYearService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('uses the establishment, school-year and class endpoints', () => {
    service.getAcademicYears('school-1').subscribe();
    http.expectOne(`${base}/school-years`).flush([]);
    service.createAcademicYear('school-1', { name: '2026-2027', startsOn: '2026-09-01', endsOn: '2027-06-30' }).subscribe();
    const year = http.expectOne(`${base}/school-years`);
    expect(year.request.method).toBe('POST');
    year.flush({});
    service.getClasses('school-1', 'year-1').subscribe();
    http.expectOne(`${base}/school-years/year-1/classes`).flush([]);
    service.createClass('school-1', 'year-1', { code: 'CP-A', name: 'CP A' }).subscribe();
    const schoolClass = http.expectOne(`${base}/school-years/year-1/classes`);
    expect(schoolClass.request.body).toEqual({ code: 'CP-A', name: 'CP A' });
    schoolClass.flush({});
  });

  it('reads, updates and archives a school year', () => {
    service.getAcademicYear('school-1', 'year-1').subscribe();
    const detail = http.expectOne(`${base}/school-years/year-1`);
    expect(detail.request.method).toBe('GET');
    detail.flush({});
    service.updateAcademicYear('school-1', 'year-1', { name: '2026-2027 bis' }).subscribe();
    const update = http.expectOne(`${base}/school-years/year-1`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ name: '2026-2027 bis' });
    update.flush({});
    service.archiveAcademicYear('school-1', 'year-1').subscribe();
    const archive = http.expectOne(`${base}/school-years/year-1`);
    expect(archive.request.method).toBe('DELETE');
    archive.flush(null);
  });

  it('updates and archives classes without a grade level', () => {
    service.updateClass('school-1', 'year-1', 'class-1', { code: 'P1-B', name: 'P1 B' }).subscribe();
    const schoolClass = http.expectOne(`${base}/school-years/year-1/classes/class-1`);
    expect(schoolClass.request.method).toBe('PATCH');
    expect(schoolClass.request.body).toEqual({ code: 'P1-B', name: 'P1 B' });
    schoolClass.flush({});
    service.archiveClass('school-1', 'year-1', 'class-1').subscribe();
    const archiveClass = http.expectOne(`${base}/school-years/year-1/classes/class-1`);
    expect(archiveClass.request.method).toBe('DELETE');
    archiveClass.flush(null);
  });
});
