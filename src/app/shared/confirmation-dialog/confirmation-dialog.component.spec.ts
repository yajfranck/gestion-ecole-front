import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfirmationDialogService } from './confirmation-dialog.service';

describe('ConfirmationDialogService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }));
  async function render() { TestBed.inject(ApplicationRef).tick(); await TestBed.inject(ApplicationRef).whenStable(); }
  it('attend une confirmation explicite et refuse les demandes multiples', async () => {
    const service = TestBed.inject(ConfirmationDialogService);
    const action = jasmine.createSpy('action');
    service.confirm('Archiver cet élément ?', action);
    service.confirm('Deuxième demande', action);
    await render();
    expect(action).not.toHaveBeenCalled();
    expect(document.querySelectorAll('app-confirmation-dialog').length).toBe(1);
    const host = document.querySelector('app-confirmation-dialog')!;
    expect(host.textContent).toContain('Archiver cet élément');
    (Array.from(host.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Confirmer')!).click();
    expect(action).toHaveBeenCalledTimes(1);
    expect(document.querySelector('app-confirmation-dialog')).toBeNull();
  });
  it('annule avec Échap sans exécuter l’action et résout les gardes de navigation', async () => {
    const result = TestBed.inject(ConfirmationDialogService).ask('Quitter la saisie ?');
    await render();
    const dialog = document.querySelector('app-confirmation-dialog dialog')!;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(await result).toBeFalse();
    expect(document.querySelector('app-confirmation-dialog')).toBeNull();
  });
});
