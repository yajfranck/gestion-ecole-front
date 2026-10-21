import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PermissionsComponent } from './permission-list.component';

describe('PermissionsComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [PermissionsComponent],
    providers: [providePermissionFixture(['can_permission_read', 'can_role_read'], ['school', 'school-1', 'other-school']), 
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { parent: { paramMap: of(convertToParamMap({ establishmentId: 'school-1' })) } } }
    ]
  }));

  it('creates the read-only permission catalog view', () => {
    expect(TestBed.createComponent(PermissionsComponent)).toBeTruthy();
  });

  it('loads only the roles and permissions available to the active establishment', () => {
    const fixture = TestBed.createComponent(PermissionsComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`${environment.apiUrl}/establishments/school-1/permissions`).flush([
      { code: 'can_student_read', description: 'Consulter les élèves.' }
    ]);
    http.expectOne(`${environment.apiUrl}/establishments/school-1/roles`).flush([
      {
        establishmentId: 'school-1',
        code: 'LOCAL_READER',
        name: 'Lecteur',
        description: null,
        enabled: true,
        editable: true,
        permissions: [{ code: 'can_student_read', description: 'Consulter les élèves.' }]
      }
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Lecteur');
    expect(fixture.nativeElement.textContent).toContain('can_student_read');
    http.verify();
  });
});