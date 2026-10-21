import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CreationPanelComponent } from './creation-panel.component';

@Component({
  imports: [CreationPanelComponent],
  template: `
    <app-creation-panel
      panelId="test-creation"
      label="Ajouter un élément"
      [busy]="busy()"
      [disabled]="disabled()"
      [completed]="completed()"
    >
      <div creation-heading><h2>Éléments</h2></div>
      <div creation-tools><input type="search" aria-label="Rechercher un élément" /></div>
      <form>
        <label>Nom<input name="name" /></label><button type="submit">Créer</button>
      </form>
    </app-creation-panel>
    <table>
      <tbody>
        <tr>
          <td>Élément existant</td>
        </tr>
      </tbody>
    </table>
  `,
})
class TestHostComponent {
  readonly busy = signal(false);
  readonly disabled = signal(false);
  readonly completed = signal<string | null>(null);
}

describe('CreationPanelComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideZonelessChangeDetection()],
    }),
  );

  function create() {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector<HTMLButtonElement>('button[aria-controls]')!;
    const panel = root.querySelector<HTMLElement>('#test-creation')!;
    return { fixture, root, trigger, panel };
  }

  it('place le bouton avant la liste et conserve la saisie à la fermeture', () => {
    const { fixture, root, trigger, panel } = create();
    expect(
      trigger.compareDocumentPosition(root.querySelector('table')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBeTrue();
    trigger.click();
    fixture.detectChanges();
    expect(panel.hidden).toBeFalse();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const input = panel.querySelector('input')!;
    input.value = 'Brouillon';
    trigger.click();
    fixture.detectChanges();
    expect(panel.hidden).toBeTrue();
    trigger.click();
    fixture.detectChanges();
    expect(panel.querySelector('input')).toBe(input);
    expect(input.value).toBe('Brouillon');
  });

  it('garde le titre et la recherche accessibles quand le formulaire est fermé', () => {
    const { root, panel } = create();
    expect(root.querySelector('h2')?.textContent).toBe('Éléments');
    const search = root.querySelector('input[type="search"]')!;
    expect(panel.contains(search)).toBeFalse();
    expect(search.closest('[hidden]')).toBeNull();
  });

  it('bloque la fermeture et les champs pendant l’enregistrement, puis ferme après succès', () => {
    const { fixture, trigger, panel } = create();
    trigger.click();
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    expect(trigger.disabled).toBeTrue();
    expect(panel.querySelector('input')?.matches(':disabled')).toBeTrue();
    trigger.click();
    fixture.detectChanges();
    expect(panel.hidden).toBeFalse();
    fixture.componentInstance.busy.set(false);
    fixture.detectChanges();
    expect(panel.hidden).toBeFalse();
    fixture.componentInstance.completed.set('Élément créé');
    fixture.detectChanges();
    expect(panel.hidden).toBeTrue();
  });

  it('permet de fermer un brouillon quand le chargement empêche une nouvelle ouverture', () => {
    const { fixture, trigger, panel } = create();
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    trigger.click();
    expect(panel.hidden).toBeTrue();
    fixture.componentInstance.disabled.set(false);
    fixture.detectChanges();
    trigger.click();
    fixture.detectChanges();
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    expect(trigger.disabled).toBeFalse();
    trigger.click();
    fixture.detectChanges();
    expect(panel.hidden).toBeTrue();
  });
});
