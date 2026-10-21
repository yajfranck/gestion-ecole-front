import { effect, EffectRef, Injectable, OnDestroy, signal, Signal, untracked } from '@angular/core';
import { ToastNotification, ToastOptions, ToastType } from '../../models/toast/toast.model';

interface ToastTimer {
  remaining: number;
  startedAt: number;
  timeout?: ReturnType<typeof setTimeout>;
  pauses: Set<string>;
}

const defaults: Record<ToastType, { title: string; duration: number }> = {
  success: { title: 'Succès', duration: 4500 },
  error: { title: 'Erreur', duration: 8000 },
  info: { title: 'Information', duration: 6000 },
  warning: { title: 'Attention', duration: 7000 }
};

@Injectable({ providedIn: 'root' })
export class ToastService implements OnDestroy {
  private readonly items = signal<ToastNotification[]>([]);
  private readonly timers = new Map<number, ToastTimer>();
  private nextId = 0;
  readonly notifications = this.items.asReadonly();

  success(message: string, options?: ToastOptions): number { return this.show(message, 'success', options); }
  error(message: string, options?: ToastOptions): number { return this.show(message, 'error', options); }
  info(message: string, options?: ToastOptions): number { return this.show(message, 'info', options); }
  warning(message: string, options?: ToastOptions): number { return this.show(message, 'warning', options); }

  show(message: string, type: ToastType = 'info', options: ToastOptions = {}): number {
    const text = message.trim();
    if (!text) return -1;
    const title = options.title?.trim() || defaults[type].title;
    const duplicate = this.items().find(item => item.type === type && item.message === text && item.title === title);
    const id = duplicate?.id ?? ++this.nextId;
    const pauses = this.timers.get(id)?.pauses ?? new Set<string>();
    this.stopTimer(id);
    if (!duplicate) {
      if (this.items().length >= 4) this.dismiss(this.items()[0].id);
      this.items.update(items => [...items, { id, type, title, message: text }]);
    }
    const duration = options.duration ?? defaults[type].duration;
    if (Number.isFinite(duration) && duration > 0) {
      this.timers.set(id, { remaining: duration, startedAt: Date.now(), pauses });
      if (!pauses.size) this.startTimer(id);
    }
    return id;
  }

  /** À appeler dans le contexte d’injection du composant : son effet suit son cycle de vie. */
  connect(message: Signal<string | null>, type: ToastType = 'success'): EffectRef {
    return effect(() => {
      const text = message();
      if (text) untracked(() => this.show(text, type));
    });
  }

  dismiss(id: number): void {
    this.stopTimer(id);
    this.items.update(items => items.filter(item => item.id !== id));
  }

  clear(): void {
    for (const id of this.timers.keys()) this.stopTimer(id);
    this.items.set([]);
  }

  pause(id: number, reason = 'pointer'): void {
    const timer = this.timers.get(id);
    if (!timer || timer.pauses.has(reason)) return;
    if (!timer.pauses.size) {
      clearTimeout(timer.timeout);
      timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
    }
    timer.pauses.add(reason);
  }

  resume(id: number, reason = 'pointer'): void {
    const timer = this.timers.get(id);
    if (!timer || !timer.pauses.delete(reason) || timer.pauses.size) return;
    this.startTimer(id);
  }

  ngOnDestroy(): void { this.clear(); }

  private startTimer(id: number): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    timer.startedAt = Date.now();
    timer.timeout = setTimeout(() => this.dismiss(id), timer.remaining);
  }

  private stopTimer(id: number): void {
    clearTimeout(this.timers.get(id)?.timeout);
    this.timers.delete(id);
  }
}
