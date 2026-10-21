import { HttpErrorResponse } from '@angular/common/http';
import { AcademicYear } from '../models/academic-year/academic-year.model';
import { TIMETABLE_DAYS, TimetableDayOfWeek } from '../models/timetable/timetable.model';
import { apiError } from './api-error';

export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function dateInYear(date: string, year: AcademicYear): boolean {
  return validCalendarDate(date) && date >= year.startsOn && date <= year.endsOn;
}
export function shiftCalendarDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function validTimetablePeriod(
  year: AcademicYear,
  from: string,
  until: string,
  day?: TimetableDayOfWeek,
): boolean {
  if (!dateInYear(from, year) || !dateInYear(until, year) || until < from) return false;
  if (!day) return true;
  const index = TIMETABLE_DAYS.findIndex((item) => item.value === day);
  if (index < 0) return false;
  const first = new Date(`${from}T00:00:00Z`).getUTCDay();
  const offset = (((index + 1) % 7) - first + 7) % 7;
  return shiftCalendarDate(from, offset) <= until;
}
export function minuteTime(value: string): string | null {
  return /^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(value) ? value.slice(0, 5) : null;
}
export function timetableError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 409)
    return 'Ce créneau entre en conflit avec un autre cours : vérifiez la salle, l’enseignant, le local physique et les périodes. Votre saisie est conservée.';
  if (error instanceof HttpErrorResponse && error.status === 400)
    return 'Vérifiez les heures, les dates, les matières et les salles. Chaque période doit contenir au moins une occurrence du jour choisi.';
  return apiError(error);
}
