import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { TableActionsComponent } from './table-actions.component';
import { TableActionDirective } from './table-action.directive';

@Component({
  imports: [TableActionsComponent, TableActionDirective, RouterLink],
  template: `
    <div style="height: 40px; overflow: auto">
      <app-table-actions label="Actions pour Alice">
        <button appTableAction="edit" (click)="edited = true">Modifier</button>
        <button appTableAction="power" actionDanger disabled>Désactiver</button>
        <a appTableAction="view" routerLink="/details">Consulter</a>
      </app-table-actions>
    </div>
    <app-table-actions label="Actions pour Bob"><button appTableAction="archive" actionDanger>Archiver</button></app-table-actions>
    <app-table-actions label="Aucune action"></app-table-actions>
    <button id="outside">Autre commande</button>
  `
})
class TestHostComponent { edited = false; }

describe('TableActionsComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [TestHostComponent],
    providers: [provideZonelessChangeDetection(), provideRouter([])]
  }));

  function create() {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector<HTMLButtonElement>('app-table-actions > button')!;
    const menu = root.querySelector<HTMLElement>('[popover]')!;
    return { fixture, root, trigger, menu };
  }

  it('ouvre le menu au-dessus des conteneurs de tableau et exécute l’action choisie', () => {
    const { fixture, trigger, menu } = create();
    expect(menu.matches(':popover-open')).toBeFalse();
    trigger.click(); fixture.detectChanges();
    expect(menu.matches(':popover-open')).toBeTrue();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-label')).toBe('Actions pour Alice');
    expect(menu.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
    menu.querySelector<HTMLButtonElement>('button')!.click(); fixture.detectChanges();
    expect(fixture.componentInstance.edited).toBeTrue();
    expect(menu.matches(':popover-open')).toBeFalse();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('parcourt les commandes au clavier en ignorant les actions désactivées puis restaure le focus', () => {
    const { fixture, trigger, menu } = create();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(menu.querySelector('button'));
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(menu.querySelector('a'));
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(menu.querySelector('button'));
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(menu.querySelector('a'));
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.matches(':popover-open')).toBeFalse();
    expect(document.activeElement).toBe(trigger);
  });

  it('ferme le menu précédent quand une autre ligne est ouverte', async () => {
    const { fixture, root, trigger, menu } = create();
    trigger.click();
    root.querySelectorAll<HTMLButtonElement>('app-table-actions > button')[1].click();
    await fixture.whenStable();
    expect(menu.matches(':popover-open')).toBeFalse();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelectorAll(':popover-open').length).toBe(1);
  });

  it('conserve les liens de navigation et ferme le menu après sélection', () => {
    const { trigger, menu } = create();
    trigger.click();
    const link = menu.querySelector<HTMLAnchorElement>('a')!;
    expect(link.getAttribute('href')).toBe('/details');
    link.addEventListener('click', (event) => event.preventDefault(), { once: true });
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    expect(menu.matches(':popover-open')).toBeFalse();
  });

  it('n’affiche pas de déclencheur pour une ligne sans commande autorisée', () => {
    const { root } = create();
    const empty = root.querySelector('app-table-actions[label="Aucune action"]')!;
    expect(empty.querySelector('button')).toBeNull();
  });

  it('partage les icônes SVG, les styles et les liens sans transformer les commandes en soumission', () => {
    const { menu } = create(); const edit = menu.querySelector('button')!;
    expect(edit.classList.contains('table-action')).toBeTrue(); expect(edit.type).toBe('button');
    const icon = edit.querySelector('svg')!; expect(icon.namespaceURI).toBe('http://www.w3.org/2000/svg'); expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(menu.querySelector('button[disabled]')!.classList.contains('table-action-danger')).toBeTrue();
    expect(menu.querySelector('a')!.getAttribute('href')).toBe('/details');
  });

  it('referme le menu lors d’un redimensionnement', () => {
    const { trigger, menu } = create();
    trigger.click();
    window.dispatchEvent(new Event('resize'));
    expect(menu.matches(':popover-open')).toBeFalse();
  });
});
