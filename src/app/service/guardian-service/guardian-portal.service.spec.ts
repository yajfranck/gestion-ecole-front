import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { environment } from '../../../environments/environment';
import { GuardianPortalService } from './guardian-portal.service';
import { validDateRange } from '../../shared/date-range';

describe('GuardianPortalService', () => {
  let service: GuardianPortalService;
  let http: HttpTestingController;
  const root = `${environment.apiUrl}/guardians/me/children/child`;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GuardianPortalService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('charge la synthèse avec l’année demandée', () => {
    service.summary('child', 'year').subscribe();
    const request = http.expectOne(`${root}/summary?academicYearId=year`);
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('utilise les historiques filtrés propres au parent', () => {
    service.payments('child', 'year', 'charge', '2026-01-01', '2026-02-01').subscribe();
    const payments = http.expectOne(`${root}/school-years/year/tuition-fees/charge/payments?from=2026-01-01&to=2026-02-01`);
    payments.flush([]);
    service.attendance('child', 'year', '2026-01-01', '2026-02-01').subscribe();
    http.expectOne(`${root}/school-years/year/attendance?from=2026-01-01&to=2026-02-01`).flush({ records: [] });
  });

  it('respecte une période inclusive de 366 jours maximum', () => {
    expect(validDateRange('2024-01-01', '2024-12-31')).toBeTrue();
    expect(validDateRange('2024-01-01', '2025-01-01')).toBeFalse();
    expect(validDateRange('2026-02-02', '2026-02-01')).toBeFalse();
    expect(validDateRange('', '')).toBeFalse();
  });
});