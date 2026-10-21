import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AUTH_SESSION_STORAGE, AuthService, AuthTokens } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { environment } from '../../environments/environment';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let authService: AuthService;

  const initialTokens: AuthTokens = {
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
        provideZonelessChangeDetection(), { provide: AUTH_SESSION_STORAGE, useValue: null },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => httpTesting.verify());

  function authenticate(): void {
    authService.login({ login: 'admin', password: 'secret' }).subscribe();
    httpTesting.expectOne(`${environment.apiUrl}/login`).flush(initialTokens);
  }

  it('adds the bearer token to API requests', () => {
    authenticate();

    http.get(`${environment.apiUrl}/user`).subscribe();
    const request = httpTesting.expectOne(`${environment.apiUrl}/user`);

    expect(request.request.headers.get('Authorization')).toBe('Bearer access-old');
    request.flush([]);
  });

  it('renews the token pair after a 401 and retries with the new access token', () => {
    authenticate();

    http.get(`${environment.apiUrl}/user`).subscribe();
    httpTesting.expectOne(`${environment.apiUrl}/user`).flush(null, {
      status: 401,
      statusText: 'Unauthorized'
    });

    const refreshRequest = httpTesting.expectOne(`${environment.apiUrl}/refresh`);
    expect(refreshRequest.request.body).toEqual({ refreshToken: 'refresh-old' });
    refreshRequest.flush(renewedTokens);

    const retryRequest = httpTesting.expectOne(`${environment.apiUrl}/user`);
    expect(retryRequest.request.headers.get('Authorization')).toBe('Bearer access-new');
    retryRequest.flush([]);
    expect(authService.session()).toEqual(renewedTokens);
  });

  it('clears the session when refresh is rejected', () => {
    authenticate();

    http.get(`${environment.apiUrl}/user`).subscribe({ error: () => undefined });
    httpTesting.expectOne(`${environment.apiUrl}/user`).flush(null, {
      status: 401,
      statusText: 'Unauthorized'
    });
    httpTesting.expectOne(`${environment.apiUrl}/refresh`).flush(null, {
      status: 401,
      statusText: 'Unauthorized'
    });

    expect(authService.session()).toBeNull();
  });

  it('shares one rotating refresh request for concurrent unauthorized calls', () => {
    authenticate();

    http.get(`${environment.apiUrl}/user`).subscribe();
    http.get(`${environment.apiUrl}/role`).subscribe();
    httpTesting.expectOne(`${environment.apiUrl}/user`).flush(null, {
      status: 401,
      statusText: 'Unauthorized'
    });
    httpTesting.expectOne(`${environment.apiUrl}/role`).flush(null, {
      status: 401,
      statusText: 'Unauthorized'
    });

    const refreshRequest = httpTesting.expectOne(`${environment.apiUrl}/refresh`);
    refreshRequest.flush(renewedTokens);

    const userRetry = httpTesting.expectOne(`${environment.apiUrl}/user`);
    const roleRetry = httpTesting.expectOne(`${environment.apiUrl}/role`);
    expect(userRetry.request.headers.get('Authorization')).toBe('Bearer access-new');
    expect(roleRetry.request.headers.get('Authorization')).toBe('Bearer access-new');
    userRetry.flush([]);
    roleRetry.flush([]);
  });
});