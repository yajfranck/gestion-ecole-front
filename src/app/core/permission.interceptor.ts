import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { API_PERMISSIONS } from './api-permissions';
import { WorkspaceAccessService } from './workspace-access.service';

const rules = API_PERMISSIONS.map(([method, path, permission]) => ({
  method, path, permission,
  pattern: new RegExp(`^${path.replace(/\{[^}]+\}/g, '[^/]+')}/?$`),
  specificity: path.replace(/\{[^}]+\}/g, '').length
})).sort((a, b) => b.specificity - a.specificity);

/** Les règles conditionnelles correspondent aux corps des annotations @PreAuthorize. */
export function requestPermissions(method: string, path: string, body: unknown): string[] | null {
  const rule = rules.find((item) => item.method === method && item.pattern.test(path));
  if (!rule) return null; // Routes publiques ou nouvelles : le backend décide toujours.
  const permissions: string[] = [rule.permission];
  const request = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  if (rule.permission === 'can_enrollment_create' && Array.isArray(request['payments']) && request['payments'].length) {
    permissions.push('can_payment_record');
  }
  if (['can_employee_create', 'can_employee_assign_roles'].includes(rule.permission)) {
    const roles = request[method === 'POST' ? 'directRoleCodes' : 'roleCodes'];
    if (Array.isArray(roles) && roles.includes('ESTABLISHMENT_ADMIN')) permissions.push('can_employee_assign_administrator');
  }
  if (rule.permission === 'can_timetable_copy' && request['replaceExisting'] === true) permissions.push('can_timetable_delete');
  return permissions;
}

export function requestRequiresPlatformScope(method: string, path: string): boolean {
  return path === '/dashboard'
    || path === '/user'
    || path === '/role'
    || path.startsWith('/role/');
}

export const permissionInterceptor: HttpInterceptorFn = (request, next) => {
  const api = environment.apiUrl.replace(/\/$/, '');
  if (!request.url.startsWith(`${api}/`)) return next(request);
  const path = request.url.slice(api.length).split(/[?#]/)[0];
  const access = inject(WorkspaceAccessService);
  const establishmentOnboarding = request.method === 'POST' && path === '/establishments';
  const permissions = establishmentOnboarding ? null : requestPermissions(request.method, path, request.body);
  const establishmentId = /\/establishments\/([^/]+)/.exec(path)?.[1];
  const allowed = permissions && (requestRequiresPlatformScope(request.method, path)
    ? permissions.every((permission) => access.hasPlatformPermission(permission))
    : access.hasAllPermissions(permissions, establishmentId));
  const message = 'Accès refusé. Vous ne disposez pas des permissions nécessaires pour cette opération.';
  if (permissions && !allowed) {
    access.notice.set(message);
    return throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden', url: request.url, error: { message } }));
  }
  return next(request).pipe(catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      access.notice.set('Accès refusé. Vos droits, votre périmètre ou la licence ne permettent pas cette opération.');
    }
    return throwError(() => error);
  }));
};
