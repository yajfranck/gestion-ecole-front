import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, defer, finalize, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { tokenClaims } from './auth-claims';
import { AuthorizationSnapshot } from '../models/authorization/authorization.model';
import { WorkspaceContextService } from '../shared/workspace-context.service';
import { environment } from '../../environments/environment';

export interface LoginCredentials {
  login: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  authorization?: AuthorizationSnapshot;
}

export const AUTH_SESSION_STORAGE = new InjectionToken<Storage | null>('AUTH_SESSION_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; }
    catch { return null; }
  }
});
const SESSION_KEY = 'gestion-ecole.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly context = inject(WorkspaceContextService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = environment.apiUrl;
  private refreshRequest: Observable<AuthTokens> | null = null;
  private refreshRequestId: symbol | null = null;
  private refreshRequestRevision: number | null = null;
  private sessionRevision = 0;
  private readonly storage = inject(AUTH_SESSION_STORAGE);
  private readonly restoredSession = this.readSession();

  readonly session = signal<AuthTokens | null>(this.restoredSession);
  readonly restoring = signal(!!this.restoredSession);

  login(credentials: LoginCredentials) {
    return defer(() => {
      this.clearSession();
      const revision = this.sessionRevision;
      return this.http.post<AuthTokens>(`${this.apiUrl}/login`, credentials)
        .pipe(tap((tokens) => {
          if (revision === this.sessionRevision) this.setSession(tokens);
        }));
    });
  }

  ensureSession(): Observable<boolean> {
    if (!this.session()) return of(false);
    const expiry = tokenClaims(this.session()?.accessToken)['exp'];
    if (!this.restoring() && !(typeof expiry === 'number' && expiry * 1000 <= Date.now())) return of(true);
    return this.refreshSession().pipe(
      map(() => !!this.session() && !this.restoring()),
      catchError((error: unknown) => {
        // Une panne réseau ne doit pas supprimer une session récupérable.
        if (error instanceof HttpErrorResponse && error.status === 401) this.clearSession();
        return of(false);
      })
    );
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/user/me/password`, request);
  }

  refreshSession(): Observable<AuthTokens> {
    if (this.refreshRequest && this.refreshRequestRevision === this.sessionRevision) {
      return this.refreshRequest;
    }

    const session = this.session();
    if (!session?.refreshToken) {
      return throwError(() => new Error('Aucun refresh token disponible.'));
    }

    const revision = this.sessionRevision;
    const requestId = Symbol();
    this.refreshRequestId = requestId;
    this.refreshRequestRevision = revision;
    this.refreshRequest = this.http
      .post<AuthTokens>(`${this.apiUrl}/refresh`, { refreshToken: session.refreshToken })
      .pipe(
        tap((tokens) => {
          if (this.sessionRevision === revision) {
            this.setSession(tokens);
          }
        }),
        finalize(() => {
          if (this.refreshRequestId === requestId) {
            this.refreshRequest = null;
            this.refreshRequestId = null;
            this.refreshRequestRevision = null;
          }
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );

    return this.refreshRequest;
  }

  logout(destination = '/login'): void {
    this.clearSession();
    void this.router.navigateByUrl(destination);
  }

  private clearSession(): void {
    this.sessionRevision++;
    this.refreshRequest = null;
    this.refreshRequestId = null;
    this.refreshRequestRevision = null;
    this.session.set(null);
    this.restoring.set(false);
    try { this.storage?.removeItem(SESSION_KEY); } catch { /* Stockage indisponible : session en mémoire. */ }
    this.context.clear();
  }

  private setSession(tokens: AuthTokens): void {
    this.sessionRevision++;
    this.session.set(tokens);
    this.restoring.set(false);
    try {
      this.storage?.setItem(SESSION_KEY, JSON.stringify({ tokens, refreshUntil: Date.now() + tokens.refreshExpiresIn * 1000 }));
    } catch { /* Stockage indisponible : session en mémoire. */ }
  }

  private readSession(): AuthTokens | null {
    try {
      const stored = JSON.parse(this.storage?.getItem(SESSION_KEY) ?? 'null');
      const tokens = stored?.tokens;
      if (stored?.refreshUntil > Date.now() && tokens && typeof tokens.accessToken === 'string'
        && typeof tokens.refreshToken === 'string' && tokens.tokenType === 'Bearer'
        && typeof tokens.expiresIn === 'number' && typeof tokens.refreshExpiresIn === 'number') return tokens;
      this.storage?.removeItem(SESSION_KEY);
    } catch { /* Une session invalide n'accorde aucun accès. */ }
    return null;
  }
}
