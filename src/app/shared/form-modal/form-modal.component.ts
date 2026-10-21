import { ToastService } from '../../service/toast-service/toast.service';
import { NgTemplateOutlet } from '@angular/common';
import { Component, contentChild, effect, input, model, output, signal, TemplateRef, untracked } from '@angular/core';
import { inject } from '@angular/core';
import { PendingChangesService } from '../pending-changes.service';
import { DialogComponent } from '../dialog/dialog.component';

/** Habillage commun des formulaires, instanciés uniquement à l’ouverture. */
@Component({
  selector: 'app-form-modal',
  imports: [DialogComponent, NgTemplateOutlet],
  templateUrl: './form-modal.component.html',
  styleUrl: './form-modal.component.css'
})
export class FormModalComponent {
  private readonly pending = inject(PendingChangesService);
  readonly protectChanges = input(false);
  readonly title = input.required<string>();
  readonly label = input('');
  readonly showTrigger = input(true);
  readonly busy = input(false);
  readonly working = signal(false);
  readonly guarded = input(false);
  readonly error = input<string | null>(null);
  readonly completed = input<unknown>(null);
  readonly open = model(false);
  readonly opened = output<void>();
  readonly closed = output<void>();
  protected readonly content = contentChild(TemplateRef);
  protected trigger: HTMLElement | null = null;
  private completion: unknown = null;

  constructor() {
    inject(ToastService).connect(this.error, 'error');
    effect(() => {
      const completed = this.completed();
      const changed = completed !== this.completion;
      this.completion = completed;
      if (completed && changed) untracked(() => this.complete());
    });
  }

  protected launch(event: Event): void {
    this.trigger = event.currentTarget as HTMLElement;
    this.opened.emit();
    this.open.set(true);
  }

  complete(): void {
    this.working.set(false);
    this.open.set(false);
    this.closed.emit();
  }

  close(): void {
    if (this.busy() || this.working()) return;
    if (this.protectChanges() && !this.pending.confirmLeave(() => this.close())) return;
    if (!this.guarded()) this.open.set(false);
    this.closed.emit();
  }
}
