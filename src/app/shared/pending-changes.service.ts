import { inject, Injectable, signal } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class PendingChangesService {
  readonly dirty = signal(false);
  readonly saving = signal(false);

  confirmLeave(): boolean {
    if (this.saving()) return false;
    if (!this.dirty()) return true;
    if (!window.confirm('Des modifications ne sont pas enregistrées. Les abandonner ?')) return false;
    this.dirty.set(false);
    return true;
  }
}

export const pendingChangesGuard: CanDeactivateFn<unknown> = () => inject(PendingChangesService).confirmLeave();