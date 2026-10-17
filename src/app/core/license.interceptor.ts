import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { LicenseFeature } from '../models/license/license.model';
import { LicenseAccessService } from './license-access.service';

export class LicenseBlockedError extends Error {
  constructor() { super('Opération bloquée par la licence de l’établissement.'); }
}

export function mutationFeature(path: string): LicenseFeature | null {
  if (/\/learning-content(?:\/|$)/.test(path)) return 'LEARNING_CONTENT';
  if (/\/attendance(?:\/|$)/.test(path)) return 'ATTENDANCE';
  if (/\/students(?:\/|$)|\/enrollments(?:\/|$)/.test(path)) return 'STUDENT_RECORDS';
  return null;
}

export const licenseInterceptor: HttpInterceptorFn = (request, next) => {
  const prefix = `${environment.apiUrl}/establishments/`;
  if (!request.url.startsWith(prefix) || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next(request);
  const path = request.url.slice(prefix.length);
  const feature = mutationFeature(path);
  if (!feature) return next(request);
  const license = inject(LicenseAccessService);
  const id = path.split('/')[0];
  if (license.decision(feature, id) !== 'blocked') return next(request);
  license.notice.set('Opération bloquée par la licence de l’établissement. Consultez la rubrique Licence plateforme.');
  return throwError(() => new LicenseBlockedError());
};