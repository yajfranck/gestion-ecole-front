export type LicenseFeature = 'SCHOOL_MANAGEMENT' | 'STUDENT_RECORDS' | 'PARENT_PORTAL' | 'TUITION' | 'ATTENDANCE' | 'LEARNING_CONTENT';
export type LicenseState = 'UPCOMING' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';

export interface PlatformLicense {
  id: number;
  establishmentId: string;
  offerId: string;
  offerCode: string;
  offerName: string;
  validFrom: string;
  validUntil: string | null;
  suspendedAt: string | null;
  state: LicenseState;
  createdBy: string;
  createdAt: string;
}

export interface LicenseOffer {
  id: string;
  code: string;
  name: string;
  features: LicenseFeature[];
  enabled: boolean;
  createdAt: string;
}

export interface AssignLicenseRequest {
  offerId: string;
  validFrom?: string;
  validUntil?: string;
}

export interface LicenseEvent {
  id: number;
  licenseId: number;
  action: string;
  actor: string;
  details: string;
  createdAt: string;
}