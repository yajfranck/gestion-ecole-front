export interface Establishment {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EstablishmentAdministratorRequest {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface OnboardEstablishmentRequest {
  code: string;
  name: string;
  administrator: EstablishmentAdministratorRequest;
}

export interface EstablishmentOnboardingResponse {
  establishment: Establishment;
  administratorInvitation: {
    employeeId: string;
    status: 'INVITATION_SENT';
  };
}
