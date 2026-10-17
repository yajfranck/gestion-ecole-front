import { HttpErrorResponse } from '@angular/common/http';
import { LicenseBlockedError } from '../core/license.interceptor';

export function apiError(error: unknown, licenseBlocked = false): string {
  if (error instanceof LicenseBlockedError) return error.message;
  if (!(error instanceof HttpErrorResponse)) return 'Une erreur est survenue. Réessayez.';
  if (error.status === 403) return licenseBlocked
    ? 'Opération bloquée par la licence de l’établissement.'
    : 'Accès refusé. Vos droits ou la licence ne permettent pas cette opération.';
  if (error.status === 404) return 'Données indisponibles ou hors de votre périmètre autorisé.';
  if (error.status === 409) return 'Conflit avec l’état actuel. Votre saisie est conservée ; rechargez les données avant de réessayer.';
  if (error.status === 400 || error.status === 413 || error.status === 415) return 'Données invalides. Vérifiez les champs, les dates et les fichiers envoyés.';
  return 'Impossible de joindre le service. Réessayez.';
}