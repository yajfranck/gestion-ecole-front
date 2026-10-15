import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { PositionService } from './position.service';

describe('PositionService', () => {
  let service: PositionService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/establishments/school-1/positions`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PositionService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('uses the documented position CRUD and role-assignment routes', () => {
    service.getPositions('school-1').subscribe();
    http.expectOne(url).flush([]);
    service.createPosition('school-1', { name: 'Enseignant', roleCodes: ['STAFF', 'SCHOOL_LIBRARIAN'] }).subscribe();
    const create = http.expectOne(url);
    expect(create.request.method).toBe('POST');
    expect(create.request.body.roleCodes).toEqual(['STAFF', 'SCHOOL_LIBRARIAN']);
    create.flush({});
    service.updatePosition('school-1', 'pos-1', { name: 'Direction' }).subscribe();
    const update = http.expectOne(`${url}/pos-1`);
    expect(update.request.method).toBe('PATCH');
    update.flush({});
    service.updatePositionRoles('school-1', 'pos-1', ['ESTABLISHMENT_ADMIN', 'SCHOOL_LIBRARIAN']).subscribe();
    const roles = http.expectOne(`${url}/pos-1/roles`);
    expect(roles.request.method).toBe('PUT');
    expect(roles.request.body).toEqual({ roleCodes: ['ESTABLISHMENT_ADMIN', 'SCHOOL_LIBRARIAN'] });
    roles.flush({});
    service.deactivatePosition('school-1', 'pos-1').subscribe();
    const remove = http.expectOne(`${url}/pos-1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });
});
