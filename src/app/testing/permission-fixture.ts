import { Provider, signal } from '@angular/core';
import { WorkspaceAccessService } from '../core/workspace-access.service';

/** Explicit rights for tests that exercise a form or navigation within its assigned schools. */
export function providePermissionFixture(
  permissions: string[],
  establishments = ['school', 'school-1'],
  platformPermissions: string[] = [],
  platformScope = false
): Provider {
  const authorities = signal(permissions);
  const access = {
    authorities,
    notice: signal<string | null>(null),
    has: (permission: string) => authorities().includes(permission),
    hasPermission: (permission: string, establishmentId?: string) => (establishmentId === undefined || establishments.includes(establishmentId)) && authorities().includes(permission),
    hasPlatformPermission: (permission: string) => platformScope && platformPermissions.includes(permission),
    canUpdateEstablishment: (establishmentId: string) => establishments.includes(establishmentId) && authorities().includes('can_establishment_update'),
    hasAnyPermission: WorkspaceAccessService.prototype.hasAnyPermission,
    hasAllPermissions: WorkspaceAccessService.prototype.hasAllPermissions,
    allows: WorkspaceAccessService.prototype.allows,
    allowsPlatform: WorkspaceAccessService.prototype.allowsPlatform
  };
  return { provide: WorkspaceAccessService, useValue: access };
}

/** Complète un double de test avec les opérateurs réels, sans lui attribuer de droit. */
export function withPermissionChecks<T extends object>(stub: T): T & WorkspaceAccessService {
  const partial = stub as Partial<WorkspaceAccessService>;
  const has = (permission: string) => partial.authorities?.().includes(permission) ?? partial.hasPermission?.(permission) ?? false;
  return {
    has,
    notice: signal<string | null>(null),
    hasPlatformPermission: partial.hasPlatformPermission ?? (() => false),
    hasAnyPermission: WorkspaceAccessService.prototype.hasAnyPermission,
    hasAllPermissions: WorkspaceAccessService.prototype.hasAllPermissions,
    allows: WorkspaceAccessService.prototype.allows,
    allowsPlatform: WorkspaceAccessService.prototype.allowsPlatform,
    ...stub,
    hasPermission: (permission: string, id?: string) => id === undefined
      ? (partial.has ?? has)(permission)
      : partial.hasPermission ? partial.hasPermission(permission, id) : (partial.has ?? has)(permission)
  } as T & WorkspaceAccessService;
}
