import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let toast: ToastService;
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 21));
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    toast = TestBed.inject(ToastService);
  });
  afterEach(() => {
    toast.clear();
    jasmine.clock().uninstall();
  });

  it('propose les quatre types et ignore les messages vides', () => {
    toast.success(' Enregistré ');
    toast.error('Échec');
    toast.info('Information utile');
    toast.warning('À vérifier');
    toast.success('   ');
    expect(toast.notifications().map(item => item.type)).toEqual(['success', 'error', 'info', 'warning']);
    expect(toast.notifications()[0].message).toBe('Enregistré');
  });

  it('ferme automatiquement les succès et laisse plus de temps pour lire les erreurs', () => {
    toast.success('Enregistré');
    toast.error('Erreur à lire');
    jasmine.clock().tick(4500);
    expect(toast.notifications().map(item => item.type)).toEqual(['error']);
    jasmine.clock().tick(3500);
    expect(toast.notifications()).toEqual([]);
  });

  it('respecte une durée personnalisée et permet les notifications persistantes', () => {
    toast.info('Temporaire', { duration: 1000 });
    const id = toast.warning('Persistante', { duration: 0, title: 'Vérification requise' });
    jasmine.clock().tick(60000);
    expect(toast.notifications()).toEqual([{ id, type: 'warning', message: 'Persistante', title: 'Vérification requise' }]);
    toast.dismiss(id);
    expect(toast.notifications()).toEqual([]);
  });

  it('reprend le temps restant seulement après la fin du survol et du focus', () => {
    const id = toast.success('À lire', { duration: 5000 });
    jasmine.clock().tick(2000);
    toast.pause(id);
    toast.pause(id, 'focus');
    jasmine.clock().tick(10000);
    toast.resume(id);
    jasmine.clock().tick(10000);
    expect(toast.notifications()).toHaveSize(1);
    toast.resume(id, 'focus');
    jasmine.clock().tick(2999);
    expect(toast.notifications()).toHaveSize(1);
    jasmine.clock().tick(1);
    expect(toast.notifications()).toEqual([]);
  });

  it('évite les doublons et renouvelle leur durée sans interrompre la lecture', () => {
    const id = toast.error('Refus', { duration: 1000 });
    jasmine.clock().tick(500);
    toast.pause(id);
    expect(toast.error('Refus', { duration: 1000 })).toBe(id);
    jasmine.clock().tick(5000);
    expect(toast.notifications()).toHaveSize(1);
    toast.resume(id);
    jasmine.clock().tick(999);
    expect(toast.notifications()).toHaveSize(1);
    jasmine.clock().tick(1);
    expect(toast.notifications()).toEqual([]);
  });

  it('limite la pile à quatre messages récents et annule les anciens délais', () => {
    for (let index = 0; index < 6; index++) toast.info(`Message ${index}`, { duration: 1000 + index * 1000 });
    expect(toast.notifications().map(item => item.message)).toEqual(['Message 2', 'Message 3', 'Message 4', 'Message 5']);
    toast.clear();
    jasmine.clock().tick(60000);
    expect(toast.notifications()).toEqual([]);
  });

  it('relie un signal existant sans rejouer le même message à chaque rendu', () => {
    const message = signal<string | null>(null);
    const connection = TestBed.runInInjectionContext(() => toast.connect(message));
    message.set('Enregistré');
    TestBed.tick();
    expect(toast.notifications()).toHaveSize(1);
    toast.dismiss(toast.notifications()[0].id);
    TestBed.tick();
    expect(toast.notifications()).toEqual([]);
    message.set(null);
    TestBed.tick();
    message.set('Enregistré');
    TestBed.tick();
    expect(toast.notifications()).toHaveSize(1);
    connection.destroy();
  });
});
