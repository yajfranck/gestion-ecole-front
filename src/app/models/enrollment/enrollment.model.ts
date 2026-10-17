export interface Enrollment {
  id: string;
  establishmentId: string;
  studentId: string;
  academicYearId: string;
  schoolClassId: string;
  classroomId: string;
  advanceAccepted: boolean;
  paymentDecisionBy: string | null;
  createdAt: string;
}

export interface EnrollmentPaymentRequest {
  feeId: string;
  amount: number;
  paymentMethodCode: string;
  reference?: string;
}

export interface CreateEnrollmentRequest {
  studentId: string;
  schoolClassId: string;
  classroomId?: string;
  acceptAdvance?: boolean;
  payments?: EnrollmentPaymentRequest[];
}

export interface EnrollmentPayment extends Omit<EnrollmentPaymentRequest, 'reference'> {
  reference: string | null;
  id: string;
  chargeId: string;
  receiptNumber: string;
  currency: string;
  paymentMethodName: string;
  receivedAt: string;
  recordedBy: string;
  totalPaid: number;
  balance: number;
}

export interface EnrollmentCreation extends Enrollment {
  payments: EnrollmentPayment[];
}

export interface ClassStudent {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
}
