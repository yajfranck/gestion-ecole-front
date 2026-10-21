import { afterNextRender, Component, ElementRef, input, OnDestroy, output, viewChild } from '@angular/core';

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

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    if (!this.busy()) this.dismiss.emit();
  }

  ngOnDestroy(): void {
    const trigger = this.returnFocusTo();
    this.dialog().nativeElement.close();
    queueMicrotask(() => { if (trigger?.isConnected) trigger.focus(); });
  }
}
