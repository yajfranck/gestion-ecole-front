export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'NON_RENSEIGNE';

export interface AttendanceEntry {
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  status: AttendanceStatus;
  absenceJustified: boolean;
  comment: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AttendanceSheet {
  establishmentId: string;
  academicYearId: string;
  schoolClassId: string;
  date: string;
  presentCount: number;
  absentCount: number;
  unreportedCount: number;
  entries: AttendanceEntry[];
}

export interface AttendanceInput {
  studentId: string;
  status: 'PRESENT' | 'ABSENT';
  absenceJustified: boolean;
  comment: string | null;
  expectedUpdatedAt?: string;
}

export interface AttendanceHistory {
  establishmentId: string;
  academicYearId: string;
  studentId: string;
  from: string;
  to: string;
  records: (Omit<AttendanceEntry, 'studentId' | 'studentNumber' | 'firstName' | 'lastName' | 'status'> & {
    date: string;
    status: 'PRESENT' | 'ABSENT';
  })[];
}