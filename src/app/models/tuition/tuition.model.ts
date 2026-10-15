export interface TuitionPaymentMethod {
  id: string;
  establishmentId: string;
  code: string;
  name: string;
}

export interface RenamePaymentMethodRequest {
  name: string;
}

export interface TuitionFeeType {
  id: string;
  establishmentId: string;
  code: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTuitionFeeTypeRequest {
  code: string;
  name: string;
}

export interface RenameTuitionFeeTypeRequest {
  name: string;
}

export interface PaymentMethodInput {
  code: string;
  name: string;
}

export type TuitionFeeScope = 'ACADEMIC_YEAR' | 'GRADE_LEVEL' | 'STUDENT';

export interface TuitionFee {
  id: string;
  establishmentId: string;
  academicYearId: string;
  name: string;
  feeTypeId: string;
  feeTypeCode: string;
  feeTypeName: string;
  amount: number;
  currency: string;
  dueDate: string;
  scope: TuitionFeeScope;
  gradeLevelId: string | null;
  studentId: string | null;
  createdAt: string;
}

export interface CreateTuitionFeeRequest {
  name: string;
  feeTypeId: string;
  amount: number;
  currency: string;
  dueDate: string;
  gradeLevelId?: string | null;
  studentId?: string | null;
}

export interface FeeCreationResponse {
  fee: TuitionFee;
  chargesCreated: number;
}

export interface ApplyTuitionFeeResponse {
  chargesCreated: number;
}

export interface TuitionPayment {
  id: string;
  receiptNumber: string;
  amount: number;
  currency: string;
  paymentMethodCode: string;
  reference: string | null;
  receivedAt: string;
  recordedBy: string;
}

export interface StudentFeeCharge {
  id: string;
  feeId: string;
  establishmentId: string;
  academicYearId: string;
  studentId: string;
  studentNumber: string;
  studentFirstName: string;
  studentLastName: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: string;
  totalPaid: number;
  balance: number;
  overdue: boolean;
  payments: TuitionPayment[];
}

export interface RecordTuitionPaymentRequest {
  amount: number;
  paymentMethodCode: string;
  reference?: string;
}

export interface PaymentReceipt {
  receiptNumber: string;
  paymentId: string;
  establishmentId: string;
  studentId: string;
  studentNumber: string;
  studentFirstName: string;
  studentLastName: string;
  feeName: string;
  amountPaid: number;
  currency: string;
  paymentMethodCode: string;
  reference: string | null;
  receivedAt: string;
  recordedBy: string;
  chargeAmount: number;
  balanceAfterPayment: number;
  dueDate: string;
}