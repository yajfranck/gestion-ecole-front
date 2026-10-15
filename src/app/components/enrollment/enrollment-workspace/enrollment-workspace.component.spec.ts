import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { EnrollmentWorkspaceComponent } from './enrollment-workspace.component';

describe('EnrollmentWorkspaceComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [EnrollmentWorkspaceComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ establishmentId: 'school-1', academicYearId: 'year-1' }) } } }
    ]
  }));

  function flushAll(http: HttpTestingController, enrollments: unknown[] = []): void {
    http.expectOne(`${base}/students`).flush([{ id: 'st-1', establishmentId: 'school-1', studentNumber: 'STU-1', firstName: 'Ada', lastName: 'Lovelace', enabled: true }]);
    http.expectOne(`${base}/grade-levels`).flush([{ id: 'l-1', establishmentId: 'school-1', code: 'P1', name: 'Primary 1', displayOrder: 1, enabled: true }]);
    http.expectOne(`${base}/school-years/year-1/classes`).flush([{ id: 'c-1', establishmentId: 'school-1', academicYearId: 'year-1', gradeLevelId: 'l-1', code: 'P1-A', name: 'Primary 1 A', enabled: true }]);
    http.expectOne(`${base}/school-years/year-1/enrollments`).flush(enrollments);
  }

  it('inscrit des élèves du dossier établissement dans les classes de l’année', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent);
    fixture.detectChanges();
    flushAll(http);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Primary 1 A');
    expect(text).toContain('Aucune inscription enregistrée');
    http.verify();
  });

  it('affiche les inscriptions existantes', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EnrollmentWorkspaceComponent);
    fixture.detectChanges();
    flushAll(http, [{ id: 'e-1', establishmentId: 'school-1', studentId: 'st-1', academicYearId: 'year-1', schoolClassId: 'c-1', createdAt: '2026-10-01T00:00:00Z' }]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('déjà inscrit');
    http.verify();
  });
});
