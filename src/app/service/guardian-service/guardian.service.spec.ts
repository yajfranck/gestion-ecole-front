import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { GuardianLink } from '../../models/guardian/guardian.model';
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

  it('lists and unlinks guardians', () => {
    service.getGuardians('school-1', 'student-1').subscribe();
    http.expectOne(url).flush([]);
    service.unlinkGuardian('school-1', 'student-1', 'g-1').subscribe();
    const unlink = http.expectOne(`${url}/g-1`);
    expect(unlink.request.method).toBe('DELETE');
    unlink.flush(null);
  });

  for (const accessStatus of ['INVITATION_SENT', 'ACCESS_ALREADY_ACTIVE'] as const) {
    it(`lie un tuteur et restitue le statut ${accessStatus} de la réponse 201`, () => {
      const body = { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org' };
      const response: GuardianLink = { guardian: { id: 'g-1', ...body }, accessStatus };
      let result: GuardianLink | undefined;
      service.linkGuardian('school-1', 'student-1', body).subscribe((link) => result = link);

      const request = http.expectOne(url);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(body);
      request.flush(response, { status: 201, statusText: 'Created' });

      expect(result).toEqual(response);
    });
  }

  it('accepts an invitation and loads the children of the current guardian', () => {
    service.acceptInvitation({ token: 't', password: 'secret-password-1' }).subscribe();
    const accept = http.expectOne(`${environment.apiUrl}/guardians/invitations/accept`);
    expect(accept.request.method).toBe('POST');
    accept.flush(null);
    service.getMyChildren().subscribe();
    http.expectOne(`${environment.apiUrl}/guardians/me/children`).flush([]);
  });
});
