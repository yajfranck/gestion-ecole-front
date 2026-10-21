import { Component, input } from '@angular/core';

/** En-tête et grille uniques pour les formulaires à lignes multiples. */
@Component({
  selector: 'app-form-rows',
  templateUrl: './form-rows.component.html',
  styleUrl: './form-rows.component.css',
  host: { class: 'block min-w-0' }
})
export class FormRowsComponent {
  readonly headings = input.required<readonly string[]>();
  readonly layout = input<'single' | 'triple'>('single');
}
