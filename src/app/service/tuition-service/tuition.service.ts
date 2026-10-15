import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApplyTuitionFeeResponse,
  CreateTuitionFeeTypeRequest,
  CreateTuitionFeeRequest,
  FeeCreationResponse,
  PaymentMethodInput,
  PaymentReceipt,
  RenamePaymentMethodRequest,
  RenameTuitionFeeTypeRequest,
  RecordTuitionPaymentRequest,
  StudentFeeCharge,
  TuitionFee,
  TuitionFeeType,
  TuitionPayment,
  TuitionPaymentMethod
} from '../../models/tuition/tuition.model';

@Injectable({ providedIn: 'root' })
export class TuitionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getPaymentMethods(establishmentId: string): Observable<TuitionPaymentMethod[]> {
    return this.http.get<TuitionPaymentMethod[]>(
      `${this.apiUrl}/establishments/${establishmentId}/payment-methods`
    );
  }

  replacePaymentMethods(establishmentId: string, methods: PaymentMethodInput[]): Observable<TuitionPaymentMethod[]> {
    return this.http.put<TuitionPaymentMethod[]>(
      `${this.apiUrl}/establishments/${establishmentId}/payment-methods`,
      { methods }
    );
  }

  renamePaymentMethod(
    establishmentId: string,
    code: string,
    request: RenamePaymentMethodRequest
  ): Observable<TuitionPaymentMethod> {
    return this.http.patch<TuitionPaymentMethod>(
      `${this.apiUrl}/establishments/${establishmentId}/payment-methods/${encodeURIComponent(code)}`,
      request
    );
  }

  deactivatePaymentMethod(establishmentId: string, code: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/establishments/${establishmentId}/payment-methods/${encodeURIComponent(code)}`
    );
  }

  getTuitionFeeTypes(establishmentId: string): Observable<TuitionFeeType[]> {
    return this.http.get<TuitionFeeType[]>(
      `${this.apiUrl}/establishments/${establishmentId}/tuition-fee-types`
    );
  }

  createTuitionFeeType(
    establishmentId: string,
    request: CreateTuitionFeeTypeRequest
  ): Observable<TuitionFeeType> {
    return this.http.post<TuitionFeeType>(
      `${this.apiUrl}/establishments/${establishmentId}/tuition-fee-types`,
      request
    );
  }

  renameTuitionFeeType(
    establishmentId: string,
    feeTypeId: string,
    request: RenameTuitionFeeTypeRequest
  ): Observable<TuitionFeeType> {
    return this.http.patch<TuitionFeeType>(
      `${this.apiUrl}/establishments/${establishmentId}/tuition-fee-types/${feeTypeId}`,
      request
    );
  }

  deactivateTuitionFeeType(establishmentId: string, feeTypeId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/establishments/${establishmentId}/tuition-fee-types/${feeTypeId}`
    );
  }

  getTuitionFees(establishmentId: string, academicYearId: string): Observable<TuitionFee[]> {
    return this.http.get<TuitionFee[]>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/tuition-fees`
    );
  }

  createTuitionFee(
    establishmentId: string,
    academicYearId: string,
    request: CreateTuitionFeeRequest
  ): Observable<FeeCreationResponse> {
    return this.http.post<FeeCreationResponse>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/tuition-fees`,
      request
    );
  }

  applyTuitionFee(establishmentId: string, academicYearId: string, feeId: string): Observable<ApplyTuitionFeeResponse> {
    return this.http.post<ApplyTuitionFeeResponse>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/tuition-fees/${feeId}/apply`,
      {}
    );
  }

  getOutstandingCharges(establishmentId: string, academicYearId: string): Observable<StudentFeeCharge[]> {
    return this.http.get<StudentFeeCharge[]>(
      `${this.apiUrl}/establishments/${establishmentId}/school-years/${academicYearId}/tuition-fees/outstanding`
    );
  }

  getStudentCharges(establishmentId: string, studentId: string): Observable<StudentFeeCharge[]> {
    return this.http.get<StudentFeeCharge[]>(
      `${this.apiUrl}/establishments/${establishmentId}/students/${studentId}/tuition-fees`
    );
  }

  recordPayment(
    establishmentId: string,
    studentId: string,
    chargeId: string,
    request: RecordTuitionPaymentRequest
  ): Observable<TuitionPayment> {
    return this.http.post<TuitionPayment>(
      `${this.apiUrl}/establishments/${establishmentId}/students/${studentId}/tuition-fees/${chargeId}/payments`,
      request
    );
  }

  getReceipt(establishmentId: string, paymentId: string): Observable<PaymentReceipt> {
    return this.http.get<PaymentReceipt>(
      `${this.apiUrl}/establishments/${establishmentId}/payments/${paymentId}/receipt`
    );
  }
}