export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  /** Durée en millisecondes ; 0 conserve le toast jusqu’à sa fermeture. */
  duration?: number;
  title?: string;
}

export interface ToastNotification {
  readonly id: number;
  readonly type: ToastType;
  readonly title: string;
  readonly message: string;
}
