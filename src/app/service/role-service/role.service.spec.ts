import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CreateRoleRequest, UpdateRoleRequest } from '../../models/role/role.model';
import { RoleService } from './role.service';

describe('RoleService', () => {
  let service: RoleService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RoleService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('reads the role catalog', () => {
    service.getRoles().subscribe();
    const request = http.expectOne(`${environment.apiUrl}/role`);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('creates a role with its permission codes', () => {
    const payload: CreateRoleRequest = {
      code: 'LIBRARIAN',
      name: 'Bibliothécaire',
      description: null,
      permissionCodes: ['can_student_read']
    };
    service.createRole(payload).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/role`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ ...payload, enabled: true, permissions: [] });
  });

  it('updates a role without changing its code', () => {
    const payload: UpdateRoleRequest = {
      name: 'Lecteur de dossiers élèves',
      description: 'Consultation des dossiers',
      permissionCodes: ['can_student_read']
    };
    service.updateRole('LIBRARIAN', payload).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/role/LIBRARIAN`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush({ code: 'LIBRARIAN', ...payload, enabled: true, permissions: [] });
  });

  it('uses establishment-scoped endpoints for local role management', () => {
    const baseUrl = `${environment.apiUrl}/establishments/school-1/roles`;
    const roleResponse = {
      establishmentId: 'school-1',
      code: 'SCHOOL_LIBRARIAN',
      name: 'Bibliothécaire',
      description: null,
      enabled: true,
      editable: true,
      permissions: []
    };

    service.getEstablishmentRoles('school-1').subscribe();
    const getRequest = http.expectOne(baseUrl);
    expect(getRequest.request.method).toBe('GET');
    getRequest.flush([roleResponse]);

    const createPayload: CreateRoleRequest = {
      code: 'SCHOOL_LIBRARIAN',
      name: 'Bibliothécaire',
      description: null,
      permissionCodes: ['can_student_read']
    };
    service.createEstablishmentRole('school-1', createPayload).subscribe();
    const createRequest = http.expectOne(baseUrl);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(createPayload);
    createRequest.flush(roleResponse);

    const updatePayload: UpdateRoleRequest = {
      name: 'Bibliothécaire principal',
      description: 'Gestion des ressources',
      permissionCodes: ['can_student_read']
    };
    service.updateEstablishmentRole('school-1', 'SCHOOL_LIBRARIAN', updatePayload).subscribe();
    const updateRequest = http.expectOne(`${baseUrl}/SCHOOL_LIBRARIAN`);
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual(updatePayload);
    updateRequest.flush({ ...roleResponse, ...updatePayload });
  });
});
