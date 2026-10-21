import { Component, contentChildren, ElementRef, HostListener, input, signal, viewChild } from '@angular/core';
import { TableActionDirective } from './table-action.directive';

let nextMenuId = 0;

@Component({
  selector: 'app-table-actions',
  templateUrl: './table-actions.component.html',
  styleUrl: './table-actions.component.css'
})
export class TableActionsComponent {
  readonly label = input('Actions');
  protected readonly actions = contentChildren(TableActionDirective, { descendants: true });
  readonly menuId = `table-actions-${nextMenuId++}`;
  protected readonly expanded = signal(false);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild.required<ElementRef<HTMLElement>>('menu');

  protected toggle(): void {
    if (this.menu().nativeElement.matches(':popover-open')) this.close();
    else this.open();
  }

  private open(last = false): void {
    const trigger = this.trigger();
    if (!trigger) return;
    const menu = this.menu().nativeElement;
    menu.showPopover();
    const rect = trigger.nativeElement.getBoundingClientRect();
    const gap = 8;
    const width = Math.min(256, window.innerWidth - gap * 2);
    menu.style.width = `${width}px`;
    menu.style.maxHeight = `${Math.max(0, window.innerHeight - gap * 2)}px`;
    menu.style.left = `${Math.max(gap, Math.min(rect.right - width, window.innerWidth - width - gap))}px`;
    const height = menu.getBoundingClientRect().height;
    const top = rect.bottom + 4 + height <= window.innerHeight - gap
      ? rect.bottom + 4 : Math.max(gap, rect.top - height - 4);
    menu.style.top = `${top}px`;
    menu.querySelectorAll<HTMLElement>('button, a[href]').forEach((item) => {
      item.setAttribute('role', 'menuitem');
      item.tabIndex = -1;
    });
    const items = this.items();
    (last ? items.at(-1) : items[0])?.focus({ preventScroll: true });
    this.expanded.set(true);
  }

  protected onToggle(event: Event): void {
    this.expanded.set((event as ToggleEvent).newState === 'open');
  }

  protected select(event: MouseEvent): void {
    const item = (event.target as HTMLElement).closest('button, a[href]');
    if (item && !item.matches(':disabled, [aria-disabled="true"]')) this.close();
  }

  protected triggerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    this.open(event.key === 'ArrowUp');
  }

  protected menuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      this.close(true);
      return;
    }
    const items = this.items();
    if (!items.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus({ preventScroll: true });
  }

  @HostListener('window:resize')
  protected onResize(): void { this.close(); }

  @HostListener('document:scroll', ['$event'])
  protected onScroll(event: Event): void {
    if (!this.menu().nativeElement.contains(event.target as Node)) this.close();
  }

  private items(): HTMLElement[] {
    return Array.from(this.menu().nativeElement.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]:not([aria-disabled="true"])'));
  }

  private close(restoreFocus = false): void {
    this.menu().nativeElement.hidePopover();
    this.expanded.set(false);
    if (restoreFocus) this.trigger()?.nativeElement.focus();
  }
}
