import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EstablishmentFormComponent } from './establishment-form.component';

describe('EstablishmentFormComponent', () => {
  let fixture: ComponentFixture<EstablishmentFormComponent>;
  const fields = {
    code: ' SCHOOL-001 ',
    name: ' École Exemple ',
    administratorFirstName: ' Ada ',
    administratorLastName: ' Lovelace ',
    administratorEmployeeNumber: ' ADM-001 ',
    administratorEmail: 'ada@example.org'
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [EstablishmentFormComponent],
      providers: [provideZonelessChangeDetection()]
    });
    fixture = TestBed.createComponent(EstablishmentFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function fill(values: Record<string, string> = fields): Promise<void> {
    for (const [name, value] of Object.entries(values)) {
      const input = fixture.nativeElement.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('émet les informations nettoyées conformes à la création de l’établissement', async () => {
    const emitted = jasmine.createSpy('submitted');
    fixture.componentInstance.submitted.subscribe(emitted);
    await fill();
    await submit();
    expect(emitted).toHaveBeenCalledOnceWith({
      code: 'SCHOOL-001',
      name: 'École Exemple',
      administrator: { employeeNumber: 'ADM-001', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.org' }
    });
  });

  it('affiche les erreurs des champs obligatoires sans soumettre', async () => {
    const emitted = jasmine.createSpy('submitted');
    fixture.componentInstance.submitted.subscribe(emitted);
    await submit();
    expect(emitted).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('[aria-invalid="true"]').length).toBe(6);
  });

  for (const invalid of [{ name: '   ' }, { administratorEmail: 'adresse-invalide' }]) {
    it(`refuse la saisie invalide ${JSON.stringify(invalid)}`, async () => {
      const emitted = jasmine.createSpy('submitted');
      fixture.componentInstance.submitted.subscribe(emitted);
      await fill({ ...fields, ...invalid });
      await submit();
      expect(emitted).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[aria-invalid="true"]')).toBeTruthy();
    });
  }

  it('bloque les actions pendant l’enregistrement et conserve les saisies après une erreur', async () => {
    const emitted = jasmine.createSpy('submitted');
    fixture.componentInstance.submitted.subscribe(emitted);
    await fill();
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    await submit();
    expect(emitted).not.toHaveBeenCalled();
    expect((fixture.nativeElement.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBeTrue();
    expect((fixture.nativeElement.querySelector('button[type="button"]') as HTMLButtonElement).disabled).toBeTrue();
    fixture.componentRef.setInput('busy', false);
    fixture.componentRef.setInput('error', 'Ce code est déjà utilisé.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('déjà utilisé');
    expect((fixture.nativeElement.querySelector('input[name="name"]') as HTMLInputElement).value).toBe(fields.name);
  });
});
