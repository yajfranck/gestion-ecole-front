import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogComponent } from './dialog.component';

describe('DialogComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [DialogComponent], providers: [provideZonelessChangeDetection()] }));
  it('ouvre une fenêtre native et permet à l’appelant de contrôler sa fermeture', async () => {
    const fixture = TestBed.createComponent(DialogComponent); fixture.componentRef.setInput('title', 'Ajouter un élève'); fixture.detectChanges(); await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement; let dismissed = 0; fixture.componentInstance.dismiss.subscribe(() => dismissed++);
    expect(dialog.open).toBeTrue(); expect(dialog.querySelector('h2')?.id).toBe(dialog.getAttribute('aria-labelledby')!);
    const event = new Event('cancel', { cancelable: true }); dialog.dispatchEvent(event); expect(event.defaultPrevented).toBeTrue(); expect(dismissed).toBe(1);
    fixture.componentRef.setInput('busy', true); fixture.detectChanges(); dialog.dispatchEvent(new Event('cancel', { cancelable: true })); expect(dismissed).toBe(1);
    fixture.destroy(); expect(dialog.open).toBeFalse();
  });
});
