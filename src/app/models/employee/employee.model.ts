import { EmployeeRole } from '../role/role.model';

export type { EmployeeRole } from '../role/role.model';

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  positionId: string;
  positionName: string;
  enabled: boolean;
  establishmentAdmin: boolean;
  directRoleCodes: EmployeeRole[];
  roles: EmployeeRole[];
  establishmentId: string;
  loginEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeRequest {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  positionId: string;
}

export interface UpdateEmployeeRequest {
  employeeNumber?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  positionId?: string;
}

export interface EmployeeInvitationResponse {
  employeeId: string;
  status: 'INVITATION_SENT';
}

export interface AcceptEmployeeInvitationRequest {
  token: string;
  password: string;
}
