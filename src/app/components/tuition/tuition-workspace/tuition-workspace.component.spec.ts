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

  it('définit la portée d’un frais par classe et envoie schoolClassId', () => {
    const fixture = TestBed.createComponent(TuitionWorkspaceComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.componentRef.setInput('classes', [{ id: 'class-1', establishmentId: 'school-1', academicYearId: 'year-1', code: 'P1-A', name: 'Primary 1 A', enabled: true }]);
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/establishments/school-1/payment-methods')).flush([]);
    http.expectOne((request) => request.url.endsWith('/establishments/school-1/tuition-fee-types')).flush([
      { id: 'fee-type-1', establishmentId: 'school-1', code: 'TUITION', name: 'Frais de scolarité', enabled: true, createdAt: '', updatedAt: '' }
    ]);
    http.expectOne((request) => request.url.endsWith('/school-years/year-1/tuition-fees')).flush([]);
    http.expectOne((request) => request.url.endsWith('/tuition-fees/outstanding')).flush([]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelectorAll('nav[aria-label="Rubriques financières"] button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    const scope = fixture.nativeElement.querySelector('select[name="feeScope"]') as HTMLSelectElement;
    expect(scope.textContent).toContain('Une classe');
    expect(scope.textContent).not.toContain('niveau');

    const component = fixture.componentInstance as unknown as Record<string, unknown> & { createFee(): void };
    Object.assign(component, { feeName: 'Frais P1', feeAmount: 125000, feeCurrency: 'XOF', feeDueDate: '2026-10-31', feeScope: 'SCHOOL_CLASS', feeSchoolClassId: 'class-1' });
    component.createFee();

    const create = http.expectOne((request) => request.method === 'POST' && request.url.endsWith('/school-years/year-1/tuition-fees'));
    expect(create.request.body).toEqual(jasmine.objectContaining({ schoolClassId: 'class-1', studentId: null }));
    expect(create.request.body).not.toEqual(jasmine.objectContaining({ gradeLevelId: jasmine.anything() }));
    create.flush({ fee: { id: 'fee-1', name: 'Frais P1' }, chargesCreated: 2 });
    http.match(() => true).forEach((request) => request.flush([]));
  });

  describe('devise du frais', () => {
    type FeeForm = Record<string, unknown> & { createFee(): void; feesError(): string | null };

    function openFeesTab() {
      const fixture = TestBed.createComponent(TuitionWorkspaceComponent);
      const http = TestBed.inject(HttpTestingController);
      fixture.componentRef.setInput('establishmentId', 'school-1');
      fixture.componentRef.setInput('academicYearId', 'year-1');
      fixture.detectChanges();
      http.expectOne((request) => request.url.endsWith('/establishments/school-1/payment-methods')).flush([]);
      http.expectOne((request) => request.url.endsWith('/establishments/school-1/tuition-fee-types')).flush([
        { id: 'fee-type-1', establishmentId: 'school-1', code: 'TUITION', name: 'Frais de scolarité', enabled: true, createdAt: '', updatedAt: '' }
      ]);
      http.expectOne((request) => request.url.endsWith('/school-years/year-1/tuition-fees')).flush([]);
      http.expectOne((request) => request.url.endsWith('/tuition-fees/outstanding')).flush([]);
      fixture.detectChanges();
      (fixture.nativeElement.querySelectorAll('nav[aria-label="Rubriques financières"] button')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      const form = fixture.componentInstance as unknown as FeeForm;
      Object.assign(form, { feeName: 'Frais P1', feeAmount: 125000, feeDueDate: '2026-10-31' });
      return { fixture, http, form };
    }

    it('propose uniquement XAF et XOF, avec XOF sélectionnée par défaut', async () => {
      const { fixture, http } = openFeesTab();
      await fixture.whenStable();
      fixture.detectChanges();

      const select = fixture.nativeElement.querySelector('select[name="feeCurrency"]') as HTMLSelectElement;
      expect(Array.from(select.options).map((option) => option.value)).toEqual(['XAF', 'XOF']);
      expect(select.textContent).toContain('Franc CFA d’Afrique centrale');
      expect(select.textContent).toContain('Franc CFA d’Afrique de l’Ouest');
      expect(select.value).toBe('XOF');
      expect(fixture.nativeElement.querySelector('input[name="feeCurrency"]')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Code à 3 lettres');
      http.match(() => true);
    });

    it('envoie XAF lorsque cette option est sélectionnée', async () => {
      const { fixture, http, form } = openFeesTab();
      await fixture.whenStable();
      const select = fixture.nativeElement.querySelector('select[name="feeCurrency"]') as HTMLSelectElement;
      select.value = 'XAF';
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      form.createFee();
      const create = http.expectOne((request) => request.method === 'POST' && request.url.endsWith('/school-years/year-1/tuition-fees'));
      expect(create.request.body.currency).toBe('XAF');
      create.flush({ fee: { id: 'fee-1', name: 'Frais P1' }, chargesCreated: 0 });
      expect(form['feeCurrency']).toBe('XAF');
      http.match(() => true).forEach((request) => request.flush([]));
    });

    it('envoie XOF par défaut', () => {
      const { http, form } = openFeesTab();
      form.createFee();
      const create = http.expectOne((request) => request.method === 'POST' && request.url.endsWith('/school-years/year-1/tuition-fees'));
      expect(create.request.body.currency).toBe('XOF');
      create.flush({ fee: { id: 'fee-1', name: 'Frais P1' }, chargesCreated: 0 });
      http.match(() => true).forEach((request) => request.flush([]));
    });

    it('refuse toute autre devise avant tout appel API', () => {
      const { http, form } = openFeesTab();
      form['feeCurrency'] = 'EUR';
      form.createFee();

      http.expectNone((request) => request.method === 'POST');
      expect(form.feesError()).toBe('Choisissez une devise valide : XAF ou XOF.');
    });
  });
});