import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { RolesComponent } from './role-list.component';

describe('RolesComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [RolesComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { parent: { paramMap: of(convertToParamMap({ establishmentId: 'school-1' })) } } }
    ]
  }));

  it('creates the role catalog view', () => {
    expect(TestBed.createComponent(RolesComponent)).toBeTruthy();
  });

  it('displays roles in a compact table with expandable permissions', () => {
    const fixture = TestBed.createComponent(RolesComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/establishments/school-1/roles')).flush([{
      establishmentId: 'school-1',
      code: 'STAFF',
      name: 'Personnel',
      description: 'Accès au personnel de l’établissement.',
      enabled: true,
      editable: false,
      permissions: [{ code: 'STAFF_ACCESS', description: 'Accès à son espace.' }]
    }]);
    fixture.detectChanges();

    const table = fixture.nativeElement.querySelector('table') as HTMLTableElement;
    expect(table).toBeTruthy();
    expect(table.textContent).toContain('Personnel');
    expect(table.textContent).toContain('STAFF');
    expect(table.textContent).toContain('1 permission');
    expect((table.querySelector('details') as HTMLDetailsElement).open).toBeFalse();
    expect(table.textContent).toContain('Rôle système');
    http.verify();
  });
});