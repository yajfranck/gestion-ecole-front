import { RolePermission } from '../permission/permission.model';

export type EmployeeRole = 'STAFF' | 'ESTABLISHMENT_ADMIN';

export interface SecurityRole {
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  permissions: RolePermission[];
}

export interface EstablishmentRole {
  establishmentId: string | null;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  editable: boolean;
  permissions: RolePermission[];
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  description: string | null;
  permissionCodes: string[];
}

export interface UpdateRoleRequest {
  name: string;
  description: string | null;
  permissionCodes: string[];
}
