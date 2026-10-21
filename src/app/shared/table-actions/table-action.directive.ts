import { booleanAttribute, Directive, ElementRef, inject, input, OnInit, Renderer2 } from '@angular/core';

const paths = {
  edit: ['m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 16v5Z'],
  archive: ['M3 3h18v4H3zM5 7v14h14V7M10 11h4'],
  trash: ['M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7'],
  view: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  history: ['M3 3v6h6M3 9a9 9 0 1 1 0 6M12 7v5l3 2'],
  roles: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 14 0v2M17 3a4 4 0 0 1 0 8m5 10v-2a7 7 0 0 0-4-6'],
  power: ['M12 2v10M5 5a9 9 0 1 0 14 0'],
  resume: ['m9 5 10 7-10 7V5Z'],
  pause: ['M8 4v16M16 4v16'],
  stop: ['M5 5h14v14H5z'],
  move: ['M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4'],
  check: ['m5 12 4 4L19 6'],
  pay: ['M3 5h18v14H3zM3 9h18M6 15h3'],
  receipt: ['M5 3h14v18l-3-2-4 2-4-2-3 2V3ZM8 7h8M8 11h8M8 15h4'],
  book: ['M12 5v15m0-15C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z'],
  door: ['M3 21h18M6 21V3h12v18M6 3l8 3v15M10 12h.01']
} as const;
export type TableActionIcon = keyof typeof paths;

/** Commande de menu commune aux boutons et liens, avec icône SVG légère. */
@Directive({ selector: 'button[appTableAction], a[appTableAction]', host: {
  class: 'table-action',
  '[class.table-action-danger]': 'danger()'
} })
export class TableActionDirective implements OnInit {
  readonly icon = input<TableActionIcon>('view', { alias: 'appTableAction' });
  readonly danger = input(false, { alias: 'actionDanger', transform: booleanAttribute });
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    if (this.host.nativeElement.tagName === 'BUTTON' && !this.host.nativeElement.hasAttribute('type')) this.renderer.setAttribute(this.host.nativeElement, 'type', 'button');
    const svg = this.renderer.createElement('svg', 'svg');
    for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'size-4 shrink-0' })) this.renderer.setAttribute(svg, name, value);
    for (const value of paths[this.icon()]) {
      const path = this.renderer.createElement('path', 'svg'); this.renderer.setAttribute(path, 'd', value); this.renderer.appendChild(svg, path);
    }
    this.renderer.insertBefore(this.host.nativeElement, svg, this.host.nativeElement.firstChild);
  }
}
