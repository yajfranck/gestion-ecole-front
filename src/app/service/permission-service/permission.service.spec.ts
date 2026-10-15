import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  let service: PermissionService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PermissionService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('reads the permission catalog', () => {
    service.getPermissions().subscribe();
    const request = http.expectOne(`${environment.apiUrl}/permission`);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('reads only the permissions assignable within an establishment', () => {
    service.getAssignablePermissions('school-1').subscribe();
    const request = http.expectOne(`${environment.apiUrl}/establishments/school-1/permissions`);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });
});
