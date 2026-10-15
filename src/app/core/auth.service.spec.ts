import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, AuthTokens } from './auth.service';
import { environment } from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  const originalTokens: AuthTokens = {
    accessToken: 'access-old',
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken: 'refresh-old',
    refreshExpiresIn: 2592000
  };

  const renewedTokens: AuthTokens = {
    accessToken: 'access-new',
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken: 'refresh-new',
    refreshExpiresIn: 2592000
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });
    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('stores the tokens returned by login', () => {
    service.login({ login: 'admin', password: 'secret' }).subscribe();
    httpTesting.expectOne(`${environment.apiUrl}/login`).flush(originalTokens);

    expect(service.session()).toEqual(originalTokens);
  });

  it('sends the current and new password to the authenticated password endpoint', () => {
    const requestBody = { currentPassword: 'old-password', newPassword: 'new-password-123' };

    service.changePassword(requestBody).subscribe();
    const request = httpTesting.expectOne(`${environment.apiUrl}/user/me/password`);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(requestBody);
    request.flush(null);
  });

  it('sends the current refresh token and replaces the full token pair', () => {
    service.login({ login: 'admin', password: 'secret' }).subscribe();
    httpTesting.expectOne(`${environment.apiUrl}/login`).flush(originalTokens);

    service.refreshSession().subscribe();
    const refreshRequest = httpTesting.expectOne(`${environment.apiUrl}/refresh`);

    expect(refreshRequest.request.body).toEqual({ refreshToken: 'refresh-old' });
    refreshRequest.flush(renewedTokens);

    expect(service.session()).toEqual(renewedTokens);
  });

  it('clears the in-memory session when logging out', () => {
    service.login({ login: 'admin', password: 'secret' }).subscribe();
    httpTesting.expectOne(`${environment.apiUrl}/login`).flush(originalTokens);

    service.logout();

    expect(service.session()).toBeNull();
  });

  it('does not restore a session if logout happens during refresh', () => {
    service.login({ login: 'admin', password: 'secret' }).subscribe();
    httpTesting.expectOne(`${environment.apiUrl}/login`).flush(originalTokens);

    service.refreshSession().subscribe();
    const refreshRequest = httpTesting.expectOne(`${environment.apiUrl}/refresh`);
    service.logout();
    refreshRequest.flush(renewedTokens);

    expect(service.session()).toBeNull();
  });
});