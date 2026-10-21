import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { tokenAuthorities, tokenClaims } from './auth-claims';
import { AuthorizationSnapshot } from '../models/authorization/authorization.model';

export type PermissionRequirement = string | readonly string[] | {
  any?: readonly PermissionRequirement[];
  all?: readonly PermissionRequirement[];
  platform?: PermissionRequirement;
};

function allowsRequirement(
  requirement: PermissionRequirement,
  hasPermission: (permission: string) => boolean,
  hasPlatformPermission: (permission: string) => boolean = () => false
): boolean {
  if (typeof requirement === 'string') return hasPermission(requirement);
  if (Array.isArray(requirement)) return requirement.length > 0 && requirement.some(hasPermission);
  if (!requirement || typeof requirement !== 'object') return false;

  const rule = requirement as { any?: readonly PermissionRequirement[]; all?: readonly PermissionRequirement[]; platform?: PermissionRequirement };
  const hasAny = Array.isArray(rule.any);
  const hasAll = Array.isArray(rule.all);
  const hasPlatform = rule.platform !== undefined;
  if (!hasAny && !hasAll && !hasPlatform) return false;

  return (!hasAll || (rule.all!.length > 0 && rule.all!.every((item) => allowsRequirement(item, hasPermission, hasPlatformPermission))))
    && (!hasAny || (rule.any!.length > 0 && rule.any!.some((item) => allowsRequirement(item, hasPermission, hasPlatformPermission))))
    && (!hasPlatform || allowsRequirement(rule.platform!, hasPlatformPermission));
}

@Injectable({ providedIn: 'root' })
export class WorkspaceAccessService {
  private readonly auth = inject(AuthService);
  private readonly authorization = computed<Partial<AuthorizationSnapshot>>(() =>
    this.auth.session()?.authorization ?? tokenClaims(this.auth.session()?.accessToken));
  readonly notice = signal<string | null>(null);
  readonly authorities = computed<string[]>(() => {
    if (!this.auth.session() || this.auth.restoring?.()) return [];
    const permissions = this.authorization().permissions;
    return Array.isArray(permissions) ? permissions.filter((value) => typeof value === 'string')
      : tokenAuthorities(this.auth.session()?.accessToken);
  });
  readonly platformScope = computed(() => !!this.auth.session() && !this.auth.restoring?.() && this.authorization().platformScope === true);
  readonly establishmentPermissions = computed(() => {
    const value = this.authorization().establishmentPermissions;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  });

  has(permission: string): boolean {
    return permission.startsWith('can_') && this.authorities().includes(permission);
  }

  hasAnyPermission(permissions: readonly string[], establishmentId?: string): boolean {
    return permissions.length > 0 && permissions.some((permission) => this.hasPermission(permission, establishmentId));
  }

  hasAllPermissions(permissions: readonly string[], establishmentId?: string): boolean {
    return permissions.length > 0 && permissions.every((permission) => this.hasPermission(permission, establishmentId));
  }

  allows(requirement: PermissionRequirement, establishmentId?: string): boolean {
    return allowsRequirement(requirement, (permission) => this.hasPermission(permission, establishmentId),
      (permission) => this.hasPlatformPermission(permission));
  }

  ensurePermissions() {
    return this.auth.ensureSession();
  }

  hasPlatformPermission(permission: string): boolean {
    const permissions = this.authorization().platformPermissions;
    return permission.startsWith('can_') && this.platformScope() && Array.isArray(permissions) && permissions.includes(permission);
  }

  allowsPlatform(requirement: PermissionRequirement): boolean {
    return allowsRequirement(requirement, (permission) => this.hasPlatformPermission(permission),
      (permission) => this.hasPlatformPermission(permission));
  }

  canUpdateEstablishment(establishmentId: string): boolean {
    return this.hasPermission('can_establishment_update', establishmentId);
  }

  hasPermission(permission: string, establishmentId?: string): boolean {
    if (!permission.startsWith('can_')) return false;
    if (establishmentId === undefined) return this.has(permission);
    if (!establishmentId) return false;
    const scopedPermissions = this.establishmentPermissions();
    if (!scopedPermissions) return this.has(permission);
    const permissions = scopedPermissions[establishmentId];
    return (Array.isArray(permissions) && permissions.includes(permission)) || this.hasPlatformPermission(permission);
  }

}
