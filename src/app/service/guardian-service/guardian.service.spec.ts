import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { GuardianService } from './guardian.service';

describe('GuardianService', () => {
  let service: GuardianService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/establishments/school-1/students/student-1/guardians`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GuardianService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists, links and unlinks guardians', () => {
    service.getGuardians('school-1', 'student-1').subscribe();
    http.expectOne(url).flush([]);
    const body = { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org' };
    service.linkGuardian('school-1', 'student-1', body).subscribe();
    const link = http.expectOne(url);
    expect(link.request.method).toBe('POST');
    expect(link.request.body).toEqual(body);
    link.flush({});
    service.unlinkGuardian('school-1', 'student-1', 'g-1').subscribe();
    const unlink = http.expectOne(`${url}/g-1`);
    expect(unlink.request.method).toBe('DELETE');
    unlink.flush(null);
  });

  it('accepts an invitation and loads the children of the current guardian', () => {
    service.acceptInvitation({ token: 't', password: 'secret-password-1' }).subscribe();
    const accept = http.expectOne(`${environment.apiUrl}/guardians/invitations/accept`);
    expect(accept.request.method).toBe('POST');
    accept.flush(null);
    service.getMyChildren().subscribe();
    http.expectOne(`${environment.apiUrl}/guardians/me/children`).flush([]);
  });
});
