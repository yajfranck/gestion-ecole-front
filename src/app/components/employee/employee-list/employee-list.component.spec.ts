import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../../../environments/environment';
import { EmployeeListComponent } from './employee-list.component';
import { EmployeeWorkspaceComponent } from '../employee-workspace/employee-workspace.component';

describe('EmployeeListComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{
          path: 'establishments/:establishmentId/team',
          component: EmployeeWorkspaceComponent,
          children: [{ path: 'employees', component: EmployeeListComponent }]
        }])
      ]
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('filters employees to the establishment in the nested team route', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/establishments/school-1/team/employees', EmployeeWorkspaceComponent);

    httpTesting.expectOne(`${environment.apiUrl}/employees`).flush([
      {
        id: 'employee-1', employeeNumber: 'EMP-001', firstName: 'Ada', lastName: 'Lovelace',
        email: 'ada@example.test', positionId: 'position-1', positionName: 'Enseignante',
        enabled: true, establishmentAdmin: false, directRoleCodes: ['STAFF'], roles: ['STAFF'],
        establishmentId: 'school-1', loginEnabled: true,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
      },
      {
        id: 'employee-2', employeeNumber: 'EMP-002', firstName: 'Grace', lastName: 'Hopper',
        email: 'grace@example.test', positionId: 'position-2', positionName: 'Enseignante',
        enabled: true, establishmentAdmin: false, directRoleCodes: ['STAFF'], roles: ['STAFF'],
        establishmentId: 'school-2', loginEnabled: true,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
      }
    ]);
    httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/positions`).flush([]);

    harness.detectChanges();
    const content = harness.routeNativeElement?.textContent ?? '';
    expect(content).toContain('Ada Lovelace');
    expect(content).not.toContain('Grace Hopper');
    expect(content).toContain('Inviter un membre du personnel');
  });
});