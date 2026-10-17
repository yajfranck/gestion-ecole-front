import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LicenseService } from './license.service';

describe('LicenseService', () => {
  let service: LicenseService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LicenseService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('consulte licences et catalogue sans offre codée en dur', () => {
    service.list('school').subscribe();
    http.expectOne(`${environment.apiUrl}/establishments/school/license`).flush([]);
    service.offers().subscribe();
    http.expectOne(`${environment.apiUrl}/admin/license-offers`).flush([]);
  });

  it('attribue une offre et utilise les transitions documentées', () => {
    const base = `${environment.apiUrl}/admin/establishments/school/licenses`;
    service.assign('school', { offerId: 'offer' }).subscribe();
    const request = http.expectOne(base);
    expect(request.request.body).toEqual({ offerId: 'offer' });
    expect(request.request.method).toBe('POST');
    request.flush({});
    for (const action of ['suspend', 'reactivate', 'end'] as const) {
      service.transition('school', 12, action).subscribe();
      http.expectOne(`${base}/12/${action}`).flush({});
    }
    service.events('school', 12).subscribe();
    http.expectOne(`${base}/12/events`).flush([]);
  });
});