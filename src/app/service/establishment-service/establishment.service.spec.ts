import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { EstablishmentService } from './establishment.service';

describe('EstablishmentService', () => {
  let service: EstablishmentService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EstablishmentService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('envoie seulement les champs fournis avec PATCH', () => {
    service.update('school-1', { name: 'Nouveau nom' }).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/establishments/school-1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: 'Nouveau nom' });
    request.flush({ id: 'school-1', code: 'S1', name: 'Nouveau nom', enabled: true });
  });
  it('lists accessible establishments and onboards one with its first administrator', () => {
    service.getAccessible().subscribe();
    http.expectOne(`${environment.apiUrl}/establishments`).flush([]);
    const requestBody = {
      code: 'NORTH-01',
      name: 'École du Nord',
      administrator: {
        employeeNumber: 'ADM-001',
        firstName: 'Alex',
        lastName: 'Exemple',
        email: 'alex@example.org'
      }
    };
    service.create(requestBody).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/establishments`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(requestBody);
    request.flush({
      establishment: { id: 'school-1', code: 'NORTH-01', name: 'École du Nord', enabled: true },
      administratorInvitation: { employeeId: 'employee-1', status: 'INVITATION_SENT' }
    });
  });
});
