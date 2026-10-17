import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { TuitionService } from './tuition.service';

describe('TuitionService', () => {
  let service: TuitionService;
  let http: HttpTestingController;
  const apiUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TuitionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists and replaces establishment payment methods', () => {
    service.getPaymentMethods('school-1').subscribe();
    const getRequest = http.expectOne(`${apiUrl}/establishments/school-1/payment-methods`);
    expect(getRequest.request.method).toBe('GET');
    getRequest.flush([]);

    const methods = [{ code: 'CASH', name: 'Espèces' }];
    service.replacePaymentMethods('school-1', methods).subscribe();
    const putRequest = http.expectOne(`${apiUrl}/establishments/school-1/payment-methods`);
    expect(putRequest.request.method).toBe('PUT');
    expect(putRequest.request.body).toEqual({ methods });
    putRequest.flush([]);

    service.renamePaymentMethod('school-1', 'CASH', { name: 'Paiement espèces' }).subscribe();
    const patchRequest = http.expectOne(`${apiUrl}/establishments/school-1/payment-methods/CASH`);
    expect(patchRequest.request.method).toBe('PATCH');
    expect(patchRequest.request.body).toEqual({ name: 'Paiement espèces' });
    patchRequest.flush({ id: 'method-1', establishmentId: 'school-1', code: 'CASH', name: 'Paiement espèces' });

    service.deactivatePaymentMethod('school-1', 'CASH').subscribe();
    const deleteRequest = http.expectOne(`${apiUrl}/establishments/school-1/payment-methods/CASH`);
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('lists and manages establishment tuition fee types', () => {
    const typesUrl = `${apiUrl}/establishments/school-1/tuition-fee-types`;
    service.getTuitionFeeTypes('school-1').subscribe();
    const getRequest = http.expectOne(typesUrl);
    expect(getRequest.request.method).toBe('GET');
    getRequest.flush([]);

    service.createTuitionFeeType('school-1', { code: 'TUITION', name: 'Frais de scolarité' }).subscribe();
    const createRequest = http.expectOne(typesUrl);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual({ code: 'TUITION', name: 'Frais de scolarité' });
    createRequest.flush({ id: 'type-1', establishmentId: 'school-1', code: 'TUITION', name: 'Frais de scolarité', enabled: true, createdAt: '', updatedAt: '' });

    service.renameTuitionFeeType('school-1', 'type-1', { name: 'Scolarité annuelle' }).subscribe();
    const renameRequest = http.expectOne(`${typesUrl}/type-1`);
    expect(renameRequest.request.method).toBe('PATCH');
    expect(renameRequest.request.body).toEqual({ name: 'Scolarité annuelle' });
    renameRequest.flush({ id: 'type-1', establishmentId: 'school-1', code: 'TUITION', name: 'Scolarité annuelle', enabled: true, createdAt: '', updatedAt: '' });

    service.deactivateTuitionFeeType('school-1', 'type-1').subscribe();
    const deleteRequest = http.expectOne(`${typesUrl}/type-1`);
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('creates and applies fees, then loads outstanding charges', () => {
    const feesUrl = `${apiUrl}/establishments/school-1/school-years/year-1/tuition-fees`;
    service.getTuitionFees('school-1', 'year-1').subscribe();
    http.expectOne(feesUrl).flush([]);

    const feeRequest = { name: 'Scolarité', feeTypeId: 'type-1', amount: 120000, currency: 'XOF', dueDate: '2026-10-31' };
    service.createTuitionFee('school-1', 'year-1', feeRequest).subscribe();
    const createRequest = http.expectOne(feesUrl);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(feeRequest);
    createRequest.flush({ fee: {}, chargesCreated: 2 });

    service.applyTuitionFee('school-1', 'year-1', 'fee-1').subscribe();
    const applyRequest = http.expectOne(`${feesUrl}/fee-1/apply`);
    expect(applyRequest.request.method).toBe('POST');
    applyRequest.flush({ chargesCreated: 1 });

    service.getOutstandingCharges('school-1', 'year-1').subscribe();
    http.expectOne(`${feesUrl}/outstanding`).flush([]);
  });

  it('transmet les classes ciblées et restitue leur sélection persistée', () => {
    const feesUrl = `${apiUrl}/establishments/school-1/school-years/year-1/tuition-fees`;
    const body = { name: 'Scolarité', feeTypeId: 'type-1', amount: 120000, currency: 'XOF', dueDate: '2026-10-31', schoolClassIds: ['class-1', 'class-2'] };
    service.createTuitionFee('school-1', 'year-1', body).subscribe(({ fee, chargesCreated }) => {
      expect(fee.schoolClassIds).toEqual(['class-2', 'class-1']);
      expect(fee.schoolClassId).toBeNull();
      expect(fee.scope).toBe('SCHOOL_CLASS');
      expect(chargesCreated).toBe(5);
    });
    const request = http.expectOne(feesUrl);
    expect(request.request.body).toEqual(body);
    request.flush({ fee: { id: 'fee-1', schoolClassIds: ['class-2', 'class-1'], schoolClassId: null, scope: 'SCHOOL_CLASS' }, chargesCreated: 5 });

    service.applyTuitionFee('school-1', 'year-1', 'fee-1').subscribe(({ chargesCreated }) => expect(chargesCreated).toBe(0));
    const apply = http.expectOne(`${feesUrl}/fee-1/apply`);
    expect(apply.request.method).toBe('POST');
    expect(apply.request.body).not.toEqual(jasmine.objectContaining({ schoolClassIds: jasmine.anything() }));
    apply.flush({ chargesCreated: 0 });
  });

  it('records a payment and retrieves its receipt', () => {
    const paymentRequest = { amount: 25000, paymentMethodCode: 'CASH', reference: 'C-01' };
    service.recordPayment('school-1', 'student-1', 'charge-1', paymentRequest).subscribe();
    const postRequest = http.expectOne(`${apiUrl}/establishments/school-1/students/student-1/tuition-fees/charge-1/payments`);
    expect(postRequest.request.method).toBe('POST');
    expect(postRequest.request.body).toEqual(paymentRequest);
    postRequest.flush({});

    service.getReceipt('school-1', 'payment-1').subscribe();
    const receiptRequest = http.expectOne(`${apiUrl}/establishments/school-1/payments/payment-1/receipt`);
    expect(receiptRequest.request.method).toBe('GET');
    receiptRequest.flush({});
  });
});
