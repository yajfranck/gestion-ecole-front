import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TuitionWorkspaceComponent } from './tuition-workspace.component';
import { TuitionFee } from '../../../models/tuition/tuition.model';

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

  it('définit la portée d’un frais pour une seule classe avec schoolClassIds', () => {
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
    expect(scope.textContent).toContain('Une ou plusieurs classes');
    expect(scope.textContent).not.toContain('niveau');

    const component = fixture.componentInstance as unknown as Record<string, unknown> & { createFee(): void };
    Object.assign(component, { feeName: 'Frais P1', feeAmount: 125000, feeCurrency: 'XOF', feeDueDate: '2026-10-31', feeScope: 'SCHOOL_CLASS', feeSchoolClassIds: ['class-1'] });
    component.createFee();

    const create = http.expectOne((request) => request.method === 'POST' && request.url.endsWith('/school-years/year-1/tuition-fees'));
    expect(create.request.body.schoolClassIds).toEqual(['class-1']);
    expect(create.request.body.schoolClassId).toBeUndefined();
    expect(create.request.body.studentId).toBeUndefined();
    expect(create.request.body).not.toEqual(jasmine.objectContaining({ gradeLevelId: jasmine.anything() }));
    create.flush({ fee: { id: 'fee-1', name: 'Frais P1' }, chargesCreated: 2 });
    http.match(() => true).forEach((request) => request.flush([]));
  });

  describe('frais pour plusieurs classes', () => {
    function openFees() {
      const fixture = TestBed.createComponent(TuitionWorkspaceComponent);
      const http = TestBed.inject(HttpTestingController);
      const classes = ['class-1', 'class-2'].map((id, index) => ({
        id, establishmentId: 'school-1', academicYearId: 'year-1', code: `P${index + 1}`, name: `Classe ${index + 1}`, enabled: true
      }));
      fixture.componentRef.setInput('establishmentId', 'school-1');
      fixture.componentRef.setInput('academicYearId', 'year-1');
      fixture.componentRef.setInput('classes', [...classes,
        { ...classes[0], id: 'archived', enabled: false },
        { ...classes[0], id: 'other-school', establishmentId: 'other' },
        { ...classes[0], id: 'other-year', academicYearId: 'other' }
      ]);
      fixture.detectChanges();
      http.expectOne((request) => request.url.endsWith('/payment-methods')).flush([]);
      http.expectOne((request) => request.url.endsWith('/tuition-fee-types')).flush([
        { id: 'fee-type-1', establishmentId: 'school-1', code: 'TUITION', name: 'Scolarité', enabled: true }
      ]);
      http.expectOne((request) => request.url.endsWith('/school-years/year-1/tuition-fees')).flush([]);
      http.expectOne((request) => request.url.endsWith('/tuition-fees/outstanding')).flush([]);
      const component = fixture.componentInstance;
      component['selectView']('fees');
      Object.assign(component, { feeName: 'Scolarité', feeAmount: 125000, feeDueDate: '2026-10-31', feeScope: 'SCHOOL_CLASS' });
      fixture.detectChanges();
      return { fixture, http, component };
    }

    it('permet de cocher plusieurs classes et crée un seul frais pour la sélection complète', () => {
      const { fixture, http, component } = openFees();
      const boxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
      expect(boxes.length).toBe(2);
      boxes[0].click();
      boxes[1].click();
      component['createFee']();
      const request = http.expectOne((request) => request.method === 'POST');
      expect(request.request.body).toEqual({
        name: 'Scolarité', feeTypeId: 'fee-type-1', amount: 125000, currency: 'XOF', dueDate: '2026-10-31', schoolClassIds: ['class-1', 'class-2']
      });
      request.flush({ fee: { name: 'Scolarité' }, chargesCreated: 5 });
      http.match(() => true).forEach((request) => request.flush([]));
      expect(component['feeSchoolClassIds']).toEqual([]);
      expect(component['successMessage']()).toContain('5 créance(s) générée(s)');
      http.verify();
    });

    it('permet de retirer une classe de la sélection', () => {
      const { fixture, component, http } = openFees();
      const box = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
      box.click();
      expect(component['feeSchoolClassIds']).toEqual(['class-1']);
      box.click();
      expect(component['feeSchoolClassIds']).toEqual([]);
      component['createFee']();
      http.expectNone((request) => request.method === 'POST');
      expect(component['feesError']()).toContain('au moins une classe active');
      http.verify();
    });

    for (const selection of [[], ['class-1', 'class-1'], ['archived'], ['other-school'], ['other-year']]) {
      it(`refuse une sélection vide, dupliquée ou hors périmètre : ${JSON.stringify(selection)}`, () => {
        const { component, http } = openFees();
        component['feeSchoolClassIds'] = selection;
        component['createFee']();
        http.expectNone((request) => request.method === 'POST');
        expect(component['feesError']()).toContain('classe active');
        http.verify();
      });
    }

    for (const scope of ['ACADEMIC_YEAR', 'STUDENT'] as const) {
      it(`omet les champs de classes pour la portée ${scope}`, () => {
        const { component, http } = openFees();
        component['feeSchoolClassIds'] = ['class-1', 'class-2'];
        component['feeScope'] = scope;
        component['feeStudentId'] = 'student-1';
        component['createFee']();
        const request = http.expectOne((request) => request.method === 'POST');
        expect(request.request.body.schoolClassIds).toBeUndefined();
        expect(request.request.body.schoolClassId).toBeUndefined();
        expect(request.request.body.studentId).toBe(scope === 'STUDENT' ? 'student-1' : undefined);
        request.flush({ fee: { name: 'Scolarité' }, chargesCreated: 0 });
        http.match(() => true).forEach((request) => request.flush([]));
        http.verify();
      });
    }

    it('conserve la sélection complète après un refus API', () => {
      const { component, http } = openFees();
      component['feeSchoolClassIds'] = ['class-1', 'class-2'];
      component['createFee']();
      http.expectOne((request) => request.method === 'POST').flush(null, { status: 409, statusText: 'Conflict' });
      expect(component['feeSchoolClassIds']).toEqual(['class-1', 'class-2']);
      expect(component['feeName']).toBe('Scolarité');
      expect(component['isCreatingFee']()).toBeFalse();
      expect(component['feesError']()).toContain('même nom');
      http.verify();
    });

    it('affiche toutes les classes du frais et conserve la lecture des anciens frais à une classe', () => {
      const { component, http } = openFees();
      expect(component['scopeLabel']({ scope: 'SCHOOL_CLASS', schoolClassId: null, schoolClassIds: ['class-2', 'class-1'] } as TuitionFee)).toBe('Classes : Classe 2, Classe 1');
      expect(component['scopeLabel']({ scope: 'SCHOOL_CLASS', schoolClassId: 'class-1' } as TuitionFee)).toBe('Classe : Classe 1');
      expect(component['scopeLabel']({ scope: 'ACADEMIC_YEAR', schoolClassIds: [] } as unknown as TuitionFee)).toBe('Toute l’année');
      http.verify();
    });
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
