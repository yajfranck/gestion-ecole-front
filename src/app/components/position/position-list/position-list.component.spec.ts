import { ToastService } from '../../../service/toast-service/toast.service';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PositionsComponent } from './position-list.component';

describe('PositionsComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [PositionsComponent],
    providers: [providePermissionFixture(['can_role_read', 'can_position_read', 'can_position_create', 'can_position_update', 'can_position_delete', 'can_position_assign_roles'], ['school', 'school-1', 'other-school']),
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { parent: { paramMap: of(convertToParamMap({ establishmentId: 'school-1' })) } } }
    ]
  }));

  it('creates the position management view', () => {
    expect(TestBed.createComponent(PositionsComponent)).toBeTruthy();
  });

  it('shows custom inherited roles in the positions table and edit form', () => {
    const fixture = TestBed.createComponent(PositionsComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/establishments/school-1/positions')).flush([
      {
        id: 'position-1',
        establishmentId: 'school-1',
        name: 'Bibliothécaire',
        enabled: true,
        roleCodes: ['SCHOOL_LIBRARIAN'],
        createdAt: '',
        updatedAt: ''
      }
    ]);
    http.expectOne((request) => request.url.endsWith('/establishments/school-1/roles')).flush([
      {
        establishmentId: 'school-1',
        code: 'SCHOOL_LIBRARIAN',
        name: 'Bibliothécaire personnalisé',
        description: null,
        enabled: true,
        editable: true,
        permissions: []
      }
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('table')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Bibliothécaire personnalisé');
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Bibliothécaire personnalisé');
    http.verify();
  });
  it('ferme la création après un enregistrement asynchrone réussi', async () => {
    const fixture = TestBed.createComponent(PositionsComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(request => request.url.endsWith('/positions')).flush([]);
    http.expectOne(request => request.url.endsWith('/roles')).flush([]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('app-form-modal > div > button') as HTMLButtonElement).click();
    fixture.detectChanges(); await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('dialog input[name="positionName"]') as HTMLInputElement;
    input.value = 'Enseignante'; input.dispatchEvent(new Event('input')); await fixture.whenStable();
    fixture.nativeElement.querySelector('dialog form').dispatchEvent(new Event('submit'));
    fixture.detectChanges(); await fixture.whenStable();
    expect((fixture.nativeElement.querySelector('dialog [aria-label="Fermer la fenêtre"]') as HTMLButtonElement).disabled).toBeTrue();
    http.expectOne(request => request.method === 'POST' && request.url.endsWith('/positions')).flush({ id: 'position-1', name: 'Enseignante', enabled: true, roleCodes: [] });
    http.expectOne(request => request.url.endsWith('/positions')).flush([]);
    fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(TestBed.inject(ToastService).notifications().map(item => item.message).join(' ')).toContain('Le poste a été créé');
    http.verify();
  });

});
