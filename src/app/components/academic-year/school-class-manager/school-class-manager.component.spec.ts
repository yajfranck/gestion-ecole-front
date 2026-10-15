import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { SchoolClassManagerComponent } from './school-class-manager.component';

describe('SchoolClassManagerComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [SchoolClassManagerComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
  }));

  it('affiche les classes avec leurs actions', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();

    http.expectOne(`${base}/school-years/year-1/classes`).flush([
      { id: 'c-1', establishmentId: 'school-1', academicYearId: 'year-1', code: 'P1-A', name: 'Primary 1 A', enabled: true }
    ]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Primary 1 A');
    expect(text).toContain('Matières et élèves');
    expect(text).toContain('Archiver');
    expect(text).toContain('Ajouter une classe');
    expect(text).not.toContain('Niveau');
    http.verify();
  });
});
