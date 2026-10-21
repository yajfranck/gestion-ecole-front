import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const apiUrl = environment.apiUrl.replace(/\/$/, '');
  const isApiRequest = request.url === apiUrl || request.url.startsWith(`${apiUrl}/`);
  const isAuthRequest = request.url === `${apiUrl}/login` || request.url === `${apiUrl}/refresh`;

  if (!isApiRequest || isAuthRequest) {
    return next(request);
  }

  const sessionUsed = authService.session();
  const tokenUsed = sessionUsed?.accessToken;
  const authenticatedRequest = sessionUsed
    ? request.clone({
        setHeaders: { Authorization: `${sessionUsed.tokenType} ${sessionUsed.accessToken}` }
      })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !tokenUsed) {
        return throwError(() => error);
      }

      const currentSession = authService.session();
      if (!currentSession) {
        return throwError(() => error);
      }

      const retryWithCurrentToken = () => {
        const currentSession = authService.session();
        if (!currentSession) {
          return throwError(() => error);
        }

        return next(
          request.clone({
            setHeaders: {
              Authorization: `${currentSession.tokenType} ${currentSession.accessToken}`
            }
          })
        );
      };

      if (currentSession.accessToken !== tokenUsed) {
        return retryWithCurrentToken();
      }

      return authService.refreshSession().pipe(
        switchMap(() => retryWithCurrentToken()),
        catchError((refreshError: unknown) => {
          if (refreshError instanceof HttpErrorResponse && refreshError.status === 401 && authService.session()?.accessToken === tokenUsed) {
            authService.logout();
          }
          return throwError(() => refreshError);
        })
      );
    })
  );
};
