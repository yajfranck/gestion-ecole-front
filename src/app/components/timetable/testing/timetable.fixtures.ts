import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { Classroom } from '../../../models/classroom/classroom.model';
import { Employee } from '../../../models/employee/employee.model';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { Subject } from '../../../models/subject/subject.model';
import { TimetableEntry, TimetableScope } from '../../../models/timetable/timetable.model';

export const timetableYear: AcademicYear = {
  id: 'year',
  establishmentId: 'school',
  name: '2026-2027',
  startsOn: '2026-09-01',
  endsOn: '2027-06-30',
  enabled: true,
};
export const timetableScope: TimetableScope = {
  establishmentId: 'school',
  academicYearId: 'year',
  schoolClassId: 'class',
  classroomId: 'room',
};
export const timetableClass: SchoolClass = {
  id: 'class',
  establishmentId: 'school',
  academicYearId: 'year',
  code: '6',
  name: 'Sixième',
  enabled: true,
};
export const timetableRoom: Classroom = {
  ...timetableScope,
  id: 'room',
  name: 'Sixième A',
  code: 'A',
  maxStudents: 40,
  enabled: true,
};
export const timetableSubject: Subject = {
  id: 'math',
  establishmentId: 'school',
  name: 'Mathématiques',
  createdAt: '',
  updatedAt: '',
  enabled: true,
};
export const timetableEmployee: Employee = {
  id: 'teacher',
  establishmentId: 'school',
  employeeNumber: 'P1',
  firstName: 'Ada',
  lastName: 'Exemple',
  email: 'ada@example.org',
  positionId: 'post',
  positionName: 'Personnel',
  enabled: true,
  loginEnabled: false,
  establishmentAdmin: false,
  roles: ['STAFF'],
  directRoleCodes: ['STAFF'],
  createdAt: '',
  updatedAt: '',
};
export const timetableEntry: TimetableEntry = {
  ...timetableScope,
  id: 'entry',
  subjectId: 'math',
  teacherId: 'teacher',
  dayOfWeek: 'MONDAY',
  startTime: '08:00:00',
  endTime: '09:00:00',
  validFrom: '2026-09-01',
  validUntil: '2027-06-30',
  roomCode: 'LAB-A',
  enabled: true,
  copiedFromId: null,
  createdBy: 'staff',
  updatedBy: 'staff',
  createdAt: '',
  updatedAt: '',
};
