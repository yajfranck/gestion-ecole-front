import { EnrollmentDraft } from './enrollment-draft.model';
import { Enrollment } from './enrollment.model';

interface EnrollmentTableDetails {
  key: string;
  studentName: string;
  studentId: string | null;
  schoolClassId: string | null;
  className: string;
  roomName: string;
  progress: string;
  updatedAt: string | null;
}

export type EnrollmentTableRow = EnrollmentTableDetails & (
  | { status: 'IN_PROGRESS'; draft: EnrollmentDraft; enrollment: null }
  | { status: 'COMPLETED'; draft: null; enrollment: Enrollment }
);
