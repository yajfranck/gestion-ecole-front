export const TIMETABLE_DAYS = [
  { value: 'MONDAY', label: 'Lundi' },
  { value: 'TUESDAY', label: 'Mardi' },
  { value: 'WEDNESDAY', label: 'Mercredi' },
  { value: 'THURSDAY', label: 'Jeudi' },
  { value: 'FRIDAY', label: 'Vendredi' },
  { value: 'SATURDAY', label: 'Samedi' },
  { value: 'SUNDAY', label: 'Dimanche' },
] as const;
export type TimetableDayOfWeek = (typeof TIMETABLE_DAYS)[number]['value'];
export interface TimetableScope {
  establishmentId: string;
  academicYearId: string;
  schoolClassId: string;
  classroomId: string;
}
export interface TimetableEntryRequest {
  subjectId: string;
  teacherId?: string | null;
  dayOfWeek: TimetableDayOfWeek;
  startTime: string;
  endTime: string;
  validFrom?: string | null;
  validUntil?: string | null;
  roomCode?: string | null;
}
export interface TimetableEntry extends TimetableScope {
  id: string;
  subjectId: string;
  teacherId: string | null;
  dayOfWeek: TimetableDayOfWeek;
  startTime: string;
  endTime: string;
  validFrom: string;
  validUntil: string;
  roomCode: string | null;
  enabled: boolean;
  copiedFromId: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface TimetableDay {
  date: string;
  withinAcademicYear: boolean;
  nonWorkingDay: string | null;
  entries: TimetableEntry[];
}
export interface TimetableWeek {
  startsOn: string;
  endsOn: string;
  days: TimetableDay[];
}
export interface CopyTimetableRequest {
  targetClassroomId: string;
  replaceExisting?: boolean;
  copyTeachers?: boolean;
  copyRoomCodes?: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
  teacherMappings?: Record<string, string>;
}
export interface TimetableNonWorkingDay {
  date: string;
  name: string;
}

export interface TimetableColumn {
  key: string;
  label: string;
  date?: string;
  withinAcademicYear: boolean;
  nonWorkingDay: string | null;
  entries: TimetableEntry[];
}
