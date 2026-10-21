import { isPastOrPresentDate } from './date-range';

describe('isPastOrPresentDate', () => {
  it('accepte une date facultative, une date passée et le jour courant', () => {
    for (const value of ['', '2016-02-29', '2026-10-18']) expect(isPastOrPresentDate(value, '2026-10-18')).toBeTrue();
  });
  it('refuse les dates futures, inexistantes et les horodatages', () => {
    for (const value of ['2026-10-19', '2025-02-29', '2026-04-31', '18/10/2026', '2026-10-18T00:00:00Z']) expect(isPastOrPresentDate(value, '2026-10-18')).toBeFalse();
  });
});
