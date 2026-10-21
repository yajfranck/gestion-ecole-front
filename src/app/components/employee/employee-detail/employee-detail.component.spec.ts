import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { EmployeeDetailComponent } from './employee-detail.component';

const employee = {
  id: 'emp-1', employeeNumber: 'STAFF-001', firstName: 'Alex', lastName: 'Exemple', email: 'alex@example.org',
  positionId: 'pos-1', positionName: 'Enseignant', enabled: true, establishmentAdmin: false,
  directRoleCodes: ['STAFF'], roles: ['STAFF'], establishmentId: 'school-1', loginEnabled: true,
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z'
};

describe('EmployeeDetailComponent', () => {
  function setup(route: { data?: Record<string, unknown>; params?: Record<string, string> }) {
    TestBed.configureTestingModule({
      imports: [EmployeeDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: route.data ?? {}, paramMap: convertToParamMap(route.params ?? {}) } } }
      ]
    });
    const fixture = TestBed.createComponent(EmployeeDetailComponent);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('charge la fiche d’un membre du personnel', () => {
    const { fixture, http } = setup({ params: { establishmentId: 'school-1', employeeId: 'emp-1' } });
    http.expectOne(`${environment.apiUrl}/establishments/school-1/employees/emp-1`).flush(employee);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Alex Exemple');
    http.verify();
  });

  it('charge la fiche du compte connecté', () => {
    const { fixture, http } = setup({ data: { self: true }, params: { establishmentId: 'school-1' } });
    http.expectOne(`${environment.apiUrl}/establishments/school-1/employees/me`).flush(employee);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Mon profil');
    http.verify();
  });
});
