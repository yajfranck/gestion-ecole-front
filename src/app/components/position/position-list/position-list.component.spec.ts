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
    providers: [
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
});