import { inject, Injectable, signal } from '@angular/core';
import { ConfirmationDialogService } from './confirmation-dialog/confirmation-dialog.service';
import { CanDeactivateFn } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class PendingChangesService {
  private readonly confirmation = inject(ConfirmationDialogService);
  readonly dirty = signal(false);
  readonly saving = signal(false);

  confirmLeave(proceed?: () => void): boolean {
    if (this.saving()) return false;
    if (!this.dirty()) return true;
    this.confirmation.confirm('Des modifications ne sont pas enregistrées. Les abandonner ?', () => {
      this.dirty.set(false);
      proceed?.();
    });
    return false;
  }

  confirmNavigation(): boolean | Promise<boolean> {
    if (this.saving()) return false;
    if (!this.dirty()) return true;
    return this.confirmation.ask('Des modifications ne sont pas enregistrées. Les abandonner ?').then(confirmed => {
      if (confirmed) this.dirty.set(false);
      return confirmed;
    });
  }

}

export const pendingChangesGuard: CanDeactivateFn<unknown> = () => inject(PendingChangesService).confirmNavigation();