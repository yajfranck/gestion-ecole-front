import { HttpErrorResponse } from '@angular/common/http';
import { timetableYear } from '../components/timetable/testing/timetable.fixtures';
import {
  dateInYear,
  minuteTime,
  shiftCalendarDate,
  timetableError,
  validTimetablePeriod,
} from './timetable';

describe('validation du planning', () => {
  it('accepte seulement des heures locales en minutes entières', () => {
    expect(minuteTime('08:30')).toBe('08:30');
    expect(minuteTime('08:30:00')).toBe('08:30');
    for (const time of ['24:00', '08:60', '8:00', '08:30:01', '08:00Z'])
      expect(minuteTime(time)).toBeNull();
  });
  it('exige une occurrence du jour dans une période inclusive de l’année', () => {
    expect(validTimetablePeriod(timetableYear, '2026-09-07', '2026-09-07', 'MONDAY')).toBeTrue();
    expect(validTimetablePeriod(timetableYear, '2026-09-08', '2026-09-08', 'MONDAY')).toBeFalse();
    expect(validTimetablePeriod(timetableYear, '2026-09-08', '2026-09-07')).toBeFalse();
    expect(validTimetablePeriod(timetableYear, '2026-08-31', '2026-09-30', 'MONDAY')).toBeFalse();
    expect(dateInYear('2027-02-29', timetableYear)).toBeFalse();
  });
  it('décale les dates civiles sans décalage de fuseau ni perte de jour aux changements d’heure', () => {
    expect(shiftCalendarDate('2026-10-24', 2)).toBe('2026-10-26');
    expect(shiftCalendarDate('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('explique un conflit sans afficher de données internes du serveur', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: { conflictingEntryId: 'other', detail: 'SQL secret' },
    });
    expect(timetableError(error)).toContain('conflit');
    expect(timetableError(error)).not.toContain('SQL secret');
  });
});
