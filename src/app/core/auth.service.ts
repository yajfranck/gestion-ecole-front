import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, Observable, shareReplay, tap, throwError } from 'rxjs';
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
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = environment.apiUrl;
  private refreshRequest: Observable<AuthTokens> | null = null;
  private refreshRequestId: symbol | null = null;
  private refreshRequestRevision: number | null = null;
  private sessionRevision = 0;

  readonly session = signal<AuthTokens | null>(null);

  login(credentials: LoginCredentials) {
    return this.http
      .post<AuthTokens>(`${this.apiUrl}/login`, credentials)
      .pipe(tap((tokens) => this.setSession(tokens)));
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
    this.sessionRevision++;
    this.refreshRequest = null;
    this.refreshRequestId = null;
    this.refreshRequestRevision = null;
    this.session.set(null);
    void this.router.navigateByUrl(destination);
  }

  private setSession(tokens: AuthTokens): void {
    this.sessionRevision++;
    this.session.set(tokens);
  }
}