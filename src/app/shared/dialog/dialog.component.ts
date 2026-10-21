import { afterNextRender, Component, ElementRef, input, OnDestroy, output, viewChild } from '@angular/core';
import { tableActionTrigger } from '../table-actions/table-action-trigger';

let nextDialogId = 0;

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css'
})
export class DialogComponent implements OnDestroy {
  protected readonly headingId = `dialog-heading-${nextDialogId++}`;
  readonly title = input.required<string>();
  readonly size = input<'default' | 'wide' | 'extra-wide'>('default');
  readonly busy = input(false);
  readonly returnFocusTo = input<HTMLElement | null>(null);
  readonly dismiss = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private fallbackTrigger: HTMLElement | null = null;

  constructor() {
    afterNextRender(() => {
      this.fallbackTrigger = tableActionTrigger(document.activeElement instanceof HTMLElement ? document.activeElement : null);
      this.dialog().nativeElement.showModal();
    });
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    if (!this.busy()) this.dismiss.emit();
  }

  ngOnDestroy(): void {
    const trigger = tableActionTrigger(this.returnFocusTo() ?? this.fallbackTrigger);
    this.dialog().nativeElement.close();
    queueMicrotask(() => { if (trigger?.isConnected) trigger.focus(); });
  }
}
