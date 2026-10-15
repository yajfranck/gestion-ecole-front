import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { AcademicYearSettingsComponent } from './academic-year-settings.component';

describe('AcademicYearSettingsComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/school-years/year-1`;
  const year = { id: 'year-1', establishmentId: 'school-1', name: '2025-2026', startsOn: '2025-09-01', endsOn: '2026-06-30', enabled: true };

  beforeEach(() => TestBed.configureTestingModule({
    imports: [AcademicYearSettingsComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
  }));

  it('envoie uniquement les champs modifiés', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AcademicYearSettingsComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('year', year);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance as unknown as { name: string; save(): void };
    component.name = '2025-2026 bis';
    component.save();

    const request = http.expectOne(url);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ name: '2025-2026 bis' });
    request.flush({ ...year, name: '2025-2026 bis' });
    http.verify();
  });
});
