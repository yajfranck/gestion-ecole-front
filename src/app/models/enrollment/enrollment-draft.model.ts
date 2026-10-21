import { LinkGuardianRequest } from '../guardian/guardian.model';

export interface EnrollmentIdentity {
  firstName: string;
  lastName: string;
}

export interface EnrollmentSelectionDraft {
  schoolClassId: string;
  classroomId: string;
  phase: number;
  acceptAdvance: boolean;
  payments: { feeId: string; amount: number | null; method: string; reference: string }[];
}

export interface EnrollmentDraft {
  version: 1;
  ownerId: string;
  id: string;
  establishmentId: string;
  academicYearId: string;
  updatedAt: string;
  step: number;
  studentId: string | null;
  identity: EnrollmentIdentity;
  guardian: LinkGuardianRequest;
  guardians?: LinkGuardianRequest[];
  selection: EnrollmentSelectionDraft;
}

export function emptyEnrollmentSelection(): EnrollmentSelectionDraft {
  return { schoolClassId: '', classroomId: '', phase: 1, acceptAdvance: false, payments: [] };
}
