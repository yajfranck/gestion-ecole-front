import { Component, effect, input, model, output } from '@angular/core';

@Component({
  selector: 'app-creation-panel',
  templateUrl: './creation-panel.component.html',
  styleUrl: './creation-panel.component.css',
})
export class CreationPanelComponent {
  readonly panelId = input.required<string>();
  readonly label = input.required<string>();
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly inset = input(true);
  readonly completed = input<unknown>(null);
  readonly open = model(false);
  readonly closed = output<void>();

  constructor() {
    effect(() => {
      if (this.completed()) this.open.set(false);
    });
  }

  protected toggle(): void {
    if (this.busy() || (!this.open() && this.disabled())) return;
    this.open.update((value) => !value);
    if (!this.open()) this.closed.emit();
  }
}
