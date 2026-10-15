export interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export type LinkGuardianRequest = Pick<Guardian, 'firstName' | 'lastName' | 'email'>;

export interface GuardianLink {
  guardian: Guardian;
  accessStatus: 'INVITATION_SENT' | 'ACCESS_ALREADY_ACTIVE';
}

export interface GuardianChild {
  id: string;
  establishmentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
}

export interface AcceptGuardianInvitationRequest {
  token: string;
  password: string;
}
