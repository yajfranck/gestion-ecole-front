export interface GuardianChildSummary {
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  establishmentId: string;
  establishmentName: string;
  academicYearId: string;
  academicYearName: string;
  startsOn: string;
  endsOn: string;
  schoolClassId: string;
  schoolClassCode: string;
  schoolClassName: string;
  balances: { currency: string; amountBilled: number; amountPaid: number; balance: number }[];
}

export interface GuardianTuitionFee {
  chargeId: string;
  feeId: string;
  academicYearId: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  totalPaid: number;
  balance: number;
  overdue: boolean;
}

export interface GuardianPayment {
  id: string;
  receiptNumber: string;
  amount: number;
  currency: string;
  paymentMethodName: string;
  reference: string | null;
  receivedAt: string;
}

export interface GuardianAttendanceHistory {
  establishmentId: string;
  academicYearId: string;
  studentId: string;
  from: string;
  to: string;
  records: {
    date: string;
    status: 'PRESENT' | 'ABSENT';
    absenceJustified: boolean;
    parentComment: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
}