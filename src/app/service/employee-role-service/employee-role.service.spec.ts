import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { EmployeeRoleService } from './employee-role.service';

describe('EmployeeRoleService', () => {
  let service: EmployeeRoleService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EmployeeRoleService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('assigns direct roles to an employee', () => {
    service.updateEmployeeRoles('school-1', 'emp-1', ['STAFF']).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/establishments/school-1/employees/emp-1/roles`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ roleCodes: ['STAFF'] });
    request.flush({});
  });
});
