import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AcademicYearClassesComponent } from './academic-year-classes.component';

describe('AcademicYearClassesComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [AcademicYearClassesComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ establishmentId: 'school-1', academicYearId: 'year-1' }) } } }
    ]
  }));

  it('gère les classes de l’année depuis une seule entrée', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AcademicYearClassesComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/grade-levels`).flush([]);
    http.expectOne(`${base}/school-years/year-1/classes`).flush([]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Classes de l’année');
    expect(text).toContain('référentiels de l’établissement');
    expect(text).not.toContain('Ajouter une matière');
    http.verify();
  });
});
