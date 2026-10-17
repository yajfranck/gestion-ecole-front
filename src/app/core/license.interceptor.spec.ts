import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { LicenseAccessService } from './license-access.service';
import { licenseInterceptor, LicenseBlockedError } from './license.interceptor';

describe('licenseInterceptor', () => {
  const license = { decision: jasmine.createSpy('decision'), notice: signal<string | null>(null) };
  beforeEach(() => {
    license.decision.and.returnValue('blocked');
    license.notice.set(null);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(withInterceptors([licenseInterceptor])), provideHttpClientTesting(), { provide: LicenseAccessService, useValue: license }] });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('bloque une mutation connue sans requête et avec un message de licence', () => {
    const url = `${environment.apiUrl}/establishments/school/school-years/year/classes/class/attendance/date`;
    TestBed.inject(HttpClient).put(url, {}).subscribe({ error: (error) => expect(error instanceof LicenseBlockedError).toBeTrue() });
    TestBed.inject(HttpTestingController).expectNone(url);
    expect(license.notice()).toContain('licence');
  });

  it('préserve les lectures historiques et la gestion des licences', () => {
    const urls = [`${environment.apiUrl}/establishments/school/school-years/year/students/child/attendance`, `${environment.apiUrl}/admin/establishments/school/licenses`];
    TestBed.inject(HttpClient).get(urls[0]).subscribe();
    TestBed.inject(HttpTestingController).expectOne(urls[0]).flush({});
    TestBed.inject(HttpClient).post(urls[1], {}).subscribe();
    TestBed.inject(HttpTestingController).expectOne(urls[1]).flush({});
  });

  it('laisse au serveur les capacités inconnues et ne bloque pas une API externe', () => {
    license.decision.and.returnValue('unknown');
    const url = `${environment.apiUrl}/establishments/school/students`;
    TestBed.inject(HttpClient).post(url, {}).subscribe();
    TestBed.inject(HttpTestingController).expectOne(url).flush({});
    TestBed.inject(HttpClient).post('https://example.org/students', {}).subscribe();
    TestBed.inject(HttpTestingController).expectOne('https://example.org/students').flush({});
  });
});