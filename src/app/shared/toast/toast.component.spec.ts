import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastService } from '../../service/toast-service/toast.service';
import { ToastComponent } from './toast.component';

describe('ToastComponent', () => {
  let fixture: ComponentFixture<ToastComponent>;
  let toast: ToastService;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ToastComponent], providers: [provideZonelessChangeDetection()] });
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(ToastComponent);
    fixture.detectChanges();
  });
  afterEach(() => { toast.clear(); fixture.destroy(); });

  it('annonce les erreurs en alerte et les autres messages sans interrompre la lecture', () => {
    toast.success('Classe créée', { duration: 0 });
    toast.error('Enregistrement impossible', { duration: 0 });
    fixture.detectChanges();
    const region = document.querySelector<HTMLElement>('[aria-label="Notifications"]')!;
    expect(region.querySelector('[role="status"]')?.textContent).toContain('Classe créée');
    expect(region.querySelector('[role="alert"]')?.textContent).toContain('Enregistrement impossible');
    expect(region.matches(':popover-open')).toBeTrue();
    region.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(toast.notifications()).toHaveSize(1);
  });

  it('affiche le texte sans interpréter de HTML', () => {
    toast.info('<img src=x onerror=alert(1)>', { duration: 0 });
    fixture.detectChanges();
    const region = document.querySelector('[aria-label="Notifications"]')!;
    expect(region.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(region.querySelector('img')).toBeNull();
  });

  it('préserve le focus dans une notification lorsqu’un autre message arrive', () => {
    toast.info('Premier message', { duration: 0 });
    fixture.detectChanges();
    const close = document.querySelector<HTMLButtonElement>('[aria-label="Notifications"] button')!;
    close.focus();
    toast.success('Nouveau message', { duration: 0 });
    fixture.detectChanges();
    expect(document.activeElement).toBe(close);
  });

  it('reste accessible et conserve ses messages lorsque la modale se ferme', async () => {
    const dialog = document.createElement('dialog');
    const input = document.createElement('input');
    dialog.append(input);
    document.body.append(dialog);
    try {
      dialog.showModal();
      input.focus();
      toast.error('Corrigez le formulaire', { duration: 0 });
      fixture.detectChanges();
      const region = dialog.querySelector<HTMLElement>('[aria-label="Notifications"]')!;
      expect(region).not.toBeNull();
      expect(document.activeElement).toBe(input);
      dialog.close();
      dialog.remove();
      await new Promise<void>(resolve => queueMicrotask(resolve));
      expect(document.body.contains(region)).toBeTrue();
      expect(region.parentElement).toBe(document.body);
      region.querySelector<HTMLButtonElement>('button')!.click();
      expect(toast.notifications()).toEqual([]);
    } finally { dialog.remove(); }
  });

  it('nettoie sa région globale à sa destruction', () => {
    toast.info('Information', { duration: 0 });
    fixture.detectChanges();
    fixture.destroy();
    expect(document.querySelector('[aria-label="Notifications"]')).toBeNull();
  });
});
