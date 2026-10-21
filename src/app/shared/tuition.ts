export function feeRequiresEnrollmentPayment(fee: { requiredForEnrollment?: boolean }): boolean {
  return fee.requiredForEnrollment !== false;
}

export function validTuitionAmount(amount: number, allowZero = false): boolean {
  return (
    Number.isFinite(amount) &&
    (allowZero ? amount >= 0 : amount > 0) &&
    /^\d{1,10}(?:\.\d{1,2})?$/.test(String(amount))
  );
}
