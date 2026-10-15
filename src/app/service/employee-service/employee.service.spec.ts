import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { EmployeeService } from './employee.service';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EmployeeService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('uses employee endpoints for listing, invitation, update and deactivation', () => {
    service.getEmployees().subscribe();
    http.expectOne(`${environment.apiUrl}/employees`).flush([]);

    service.inviteEmployee({ employeeNumber: 'EMP-01', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', positionId: 'pos-1' }).subscribe();
    const invitation = http.expectOne(`${environment.apiUrl}/employees`);
    expect(invitation.request.method).toBe('POST');
    expect(invitation.request.body.positionId).toBe('pos-1');
    invitation.flush({ employeeId: 'emp-1', status: 'INVITATION_SENT' });

    service.updateEmployee('emp-1', { firstName: 'Augusta' }).subscribe();
    const update = http.expectOne(`${environment.apiUrl}/employees/emp-1`);
    expect(update.request.method).toBe('PATCH');
    update.flush({});

    service.deactivateEmployee('emp-1').subscribe();
    const deactivate = http.expectOne(`${environment.apiUrl}/employees/emp-1`);
    expect(deactivate.request.method).toBe('DELETE');
    deactivate.flush(null);
  });

  it('accepts an employee invitation without requiring a login first', () => {
    const requestBody = { token: 'invite-token', password: 'a-secure-password-123' };
    service.acceptInvitation(requestBody).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/employees/invitations/accept`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(requestBody);
    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});
