import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GuardianFormComponent } from './guardian-form.component';

const value = { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org' };

describe('GuardianFormComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [GuardianFormComponent], providers: [provideZonelessChangeDetection()] }));
  async function setup(initialValues = [value]) {
    const fixture = TestBed.createComponent(GuardianFormComponent);
    fixture.componentRef.setInput('initialValues', initialValues); fixture.componentRef.setInput('canLink', true); fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges(); await fixture.whenStable(); return fixture;
  }
  it('ajoute une ligne et permet de modifier la précédente avec un bouton SVG', async () => {
    const fixture = await setup(); const root = fixture.nativeElement as HTMLElement;
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Ajouter un tuteur')!.click(); fixture.detectChanges(); await fixture.whenStable();
    expect(root.querySelectorAll('input').length).toBe(6);
    const first = root.querySelector<HTMLInputElement>('input')!; expect(first.readOnly).toBeTrue();
    const edit = root.querySelector<HTMLButtonElement>('button[aria-label="Modifier le tuteur 1"]')!;
    expect(edit.querySelector('svg')).not.toBeNull(); edit.click(); fixture.detectChanges();
    expect(first.readOnly).toBeFalse(); first.value = 'Augusta'; first.dispatchEvent(new Event('input')); await fixture.whenStable();
    expect(fixture.componentInstance.snapshot()[0].firstName).toBe('Augusta');
    root.querySelector<HTMLButtonElement>('button[aria-label="Supprimer le tuteur 2"]')!.click(); fixture.detectChanges();
    expect(fixture.componentInstance.snapshot().length).toBe(1);
  });
  it('valide toutes les lignes et refuse les e-mails en double avant émission', async () => {
    const fixture = await setup([value, { ...value, email: ' GRACE@EXAMPLE.ORG ' }]);
    const submitted = jasmine.createSpy('submitted'); fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.submit(); fixture.detectChanges();
    expect(submitted).not.toHaveBeenCalled(); expect(fixture.nativeElement.textContent).toContain('adresse e-mail différente');
  });
  it('préremplit les brouillons incomplets et ne recrée pas un tuteur déjà enregistré', async () => {
    const fixture = TestBed.createComponent(GuardianFormComponent);
    fixture.componentRef.setInput('guardians', [{ id: 'guardian', ...value }]);
    fixture.componentRef.setInput('initialValues', [value, { firstName: 'Marie', lastName: '', email: '' }]);
    fixture.componentRef.setInput('canLink', true); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.componentInstance.snapshot()).toEqual([{ firstName: 'Marie', lastName: '', email: '' }]);
    expect(fixture.nativeElement.querySelectorAll('input').length).toBe(6);
    expect(fixture.nativeElement.querySelector('button[aria-label="Modifier le tuteur 1"]')).toBeNull();
  });
  it('bloque les changements et les actions pendant l’enregistrement', async () => {
    const fixture = await setup(); fixture.componentRef.setInput('disabled', true); fixture.detectChanges();
    const submitted = jasmine.createSpy('submitted'); fixture.componentInstance.submitted.subscribe(submitted);
    fixture.componentInstance.submit();
    expect(submitted).not.toHaveBeenCalled(); expect(fixture.nativeElement.querySelector('fieldset').disabled).toBeTrue();
  });
});
