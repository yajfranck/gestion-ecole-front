import { Component, input, output } from '@angular/core';
import { DialogComponent } from '../dialog/dialog.component';

@Component({
  selector: 'app-confirmation-dialog',
  imports: [DialogComponent],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.css'
})
export class ConfirmationDialogComponent {
  readonly message = input.required<string>();
  readonly title = input('Confirmer l’action');
  readonly trigger = input<HTMLElement | null>(null);
  readonly resolved = output<boolean>();
}
