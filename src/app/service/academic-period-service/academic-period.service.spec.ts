import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AcademicPeriodService } from './academic-period.service';

describe('AcademicPeriodService', () => {
  let service: AcademicPeriodService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/establishments/school-1/school-years/year-1/periods`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AcademicPeriodService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists, creates, updates and archives periods', () => {
    service.getPeriods('school-1', 'year-1').subscribe();
    http.expectOne(url).flush([]);

    const body = { name: 'Période 1', startsOn: '2026-09-01', endsOn: '2026-12-20' };
    service.createPeriod('school-1', 'year-1', body).subscribe();
    const create = http.expectOne(url);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(body);
    create.flush({});

    service.updatePeriod('school-1', 'year-1', 'p-1', { name: 'P1' }).subscribe();
    const update = http.expectOne(`${url}/p-1`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ name: 'P1' });
    update.flush({});

    service.archivePeriod('school-1', 'year-1', 'p-1').subscribe();
    const archive = http.expectOne(`${url}/p-1`);
    expect(archive.request.method).toBe('DELETE');
    archive.flush(null);
  });
});
