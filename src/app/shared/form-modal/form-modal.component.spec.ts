import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormModalComponent } from './form-modal.component';

@Component({ imports: [FormModalComponent], template: '<app-form-modal title="Créer un élément" [busy]="busy()" [completed]="done()" (opened)="done.set(null)"><ng-template><form><input name="name" autofocus><button type="submit">Enregistrer</button></form></ng-template></app-form-modal>' })
class HostComponent { busy = signal(false); done = signal<string | null>(null); }

describe('FormModalComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideZonelessChangeDetection()] }));
  it('instancie le formulaire à l’ouverture et restaure le focus après fermeture', async () => {
    const fixture = TestBed.createComponent(HostComponent); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.click(); fixture.detectChanges(); await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBeTrue();
    expect(dialog.querySelector('form')).toBeTruthy();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true })); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it('bloque la fermeture pendant l’enregistrement et ferme après succès', async () => {
    const fixture = TestBed.createComponent(HostComponent); fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click(); fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.busy.set(true); fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true })); fixture.detectChanges();
    expect(dialog.open).toBeTrue();
    expect((dialog.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBeTrue();
    fixture.componentInstance.busy.set(false); fixture.componentInstance.done.set('Enregistré'); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
  });
});
