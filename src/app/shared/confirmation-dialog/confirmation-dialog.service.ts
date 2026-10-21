import { DOCUMENT } from '@angular/common';
import { ApplicationRef, createComponent, EnvironmentInjector, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { ConfirmationDialogComponent } from './confirmation-dialog.component';

@Injectable({ providedIn: 'root' })
export class ConfirmationDialogService {
  private readonly app = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  private active = false;
  private cancelActive: (() => void) | null = null;

  constructor() {
    inject(Router, { optional: true })?.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart) this.cancelActive?.();
    });
  }

  confirm(message: string, accept: () => void, title = 'Confirmer l’action'): void {
    this.present(message, confirmed => { if (confirmed) accept(); }, title);
  }

  ask(message: string): Promise<boolean> {
    return new Promise(resolve => this.present(message, resolve));
  }

  private present(message: string, resolve: (value: boolean) => void, title = 'Confirmer l’action'): void {
    if (this.active) { resolve(false); return; }
    this.active = true;
    const host = this.document.createElement('app-confirmation-dialog');
    const component = createComponent(ConfirmationDialogComponent, { environmentInjector: this.injector, hostElement: host });
    component.setInput('message', message);
    component.setInput('title', title);
    component.setInput('trigger', this.document.activeElement instanceof HTMLElement ? this.document.activeElement : null);
    this.document.body.append(host);
    this.app.attachView(component.hostView);
    let settled = false;
    const finish = (confirmed: boolean) => {
      if (settled) return;
      settled = true;
      this.app.detachView(component.hostView);
      component.destroy();
      host.remove();
      this.active = false;
      this.cancelActive = null;
      resolve(confirmed);
    };
    this.cancelActive = () => finish(false);
    component.instance.resolved.subscribe(finish);
    component.changeDetectorRef.detectChanges();
  }
}
