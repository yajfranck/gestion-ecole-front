import { DOCUMENT } from '@angular/common';
import { afterNextRender, afterRenderEffect, Component, ElementRef, inject, OnDestroy, viewChild } from '@angular/core';
import { ToastService } from '../../service/toast-service/toast.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css'
})
export class ToastComponent implements OnDestroy {
  protected readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly region = viewChild.required<ElementRef<HTMLElement>>('region');
  private observer?: MutationObserver;

  constructor() {
    afterRenderEffect(() => {
      this.toast.notifications();
      this.syncLayer();
    });
    afterNextRender(() => {
      // Le toast reste interactif au-dessus des modales natives, sans prendre le focus.
      this.observer = new MutationObserver(records => {
        if (records.some(record => (record.target instanceof HTMLDialogElement && record.attributeName === 'open')
          || [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element
            && (node.matches('dialog') || !!node.querySelector('dialog'))))) this.syncLayer();
      });
      this.observer.observe(this.document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    });
  }

  protected onFocusOut(event: FocusEvent, id: number): void {
    const card = event.currentTarget as HTMLElement;
    if (!(event.relatedTarget instanceof Node) || !card.contains(event.relatedTarget)) this.toast.resume(id, 'focus');
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.region().nativeElement.remove();
  }

  private syncLayer(): void {
    const region = this.region().nativeElement;
    const parent = [...this.document.querySelectorAll('dialog[open]')].at(-1) ?? this.document.body;
    if (region.parentElement !== parent) {
      region.hidePopover();
      parent.append(region);
    }
    if (!this.toast.notifications().length) { region.hidePopover(); return; }
    if (region.isConnected && !region.matches(':popover-open')) region.showPopover();
  }
}
