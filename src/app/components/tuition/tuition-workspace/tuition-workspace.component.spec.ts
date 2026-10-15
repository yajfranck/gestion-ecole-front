import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TuitionWorkspaceComponent } from './tuition-workspace.component';

describe('TuitionWorkspaceComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [TuitionWorkspaceComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
  }));

  it('shows one financial section at a time and switches between sections', () => {
    const fixture = TestBed.createComponent(TuitionWorkspaceComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();

    http.expectOne((request) => request.url.endsWith('/establishments/school-1/payment-methods')).flush([]);
    http.expectOne((request) => request.url.endsWith('/establishments/school-1/tuition-fee-types')).flush([
      { id: 'fee-type-1', establishmentId: 'school-1', code: 'TUITION', name: 'Frais de scolarité', enabled: true, createdAt: '', updatedAt: '' }
    ]);
    http.expectOne((request) => request.url.endsWith('/establishments/school-1/school-years/year-1/tuition-fees')).flush([]);
    http.expectOne((request) => request.url.endsWith('/establishments/school-1/school-years/year-1/tuition-fees/outstanding')).flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Créances et soldes à régler');
    expect(fixture.nativeElement.textContent).not.toContain('Définir un frais scolaire');

    const tabs = fixture.nativeElement.querySelectorAll('nav[aria-label="Rubriques financières"] button') as NodeListOf<HTMLButtonElement>;
    tabs[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Définir un frais scolaire');
    expect(fixture.nativeElement.textContent).not.toContain('Créances et soldes à régler');
    const feeTypeSelect = fixture.nativeElement.querySelector('select[name="feeTypeId"]') as HTMLSelectElement;
    expect(feeTypeSelect.value).toBe('fee-type-1');
    expect(feeTypeSelect.textContent).toContain('Frais de scolarité');

    tabs[3].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Moyens de paiement');
    expect(fixture.nativeElement.textContent).toContain('Types de frais');
    expect(fixture.nativeElement.textContent).toContain('TUITION');
    expect(fixture.nativeElement.textContent).not.toContain('Définir un frais scolaire');
    http.verify();
  });
});