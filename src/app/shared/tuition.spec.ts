import { feeRequiresEnrollmentPayment, validTuitionAmount } from './tuition';

describe('Règles de frais et montants', () => {
  it('conserve les anciens frais comme obligatoires et ne dispense que les frais explicitement facultatifs', () => {
    expect(feeRequiresEnrollmentPayment({})).toBeTrue();
    expect(feeRequiresEnrollmentPayment({ requiredForEnrollment: true })).toBeTrue();
    expect(feeRequiresEnrollmentPayment({ requiredForEnrollment: false })).toBeFalse();
  });
  it('respecte les limites de précision et de taille des montants de l’API', () => {
    for (const amount of [0.01, 100, 9999999999.99]) expect(validTuitionAmount(amount)).toBeTrue();
    for (const amount of [0, -1, 0.001, 1e-7, 10000000000, NaN, Infinity])
      expect(validTuitionAmount(amount)).toBeFalse();
    expect(validTuitionAmount(0, true)).toBeTrue();
  });
});
