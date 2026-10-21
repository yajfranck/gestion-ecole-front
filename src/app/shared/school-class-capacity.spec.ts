import { SchoolClass } from '../models/school-class/school-class.model';
import { schoolClassCapacity } from './school-class-capacity';

const schoolClass: SchoolClass = { id: 'class', establishmentId: 'school', academicYearId: 'year', code: '6A', name: 'Sixième A', enabled: true, classroomCount: 2, totalCapacity: 80, enrolledStudentCount: 76 };

describe('schoolClassCapacity', () => {
  it('utilise les agrégats renvoyés par la classe', () => {
    expect(schoolClassCapacity(schoolClass)).toEqual({ activeRooms: 2, capacity: 80, enrolled: 76, remaining: 4 });
  });
  it('conserve les zéros et empêche un nombre de places négatif', () => {
    expect(schoolClassCapacity({ ...schoolClass, classroomCount: 0, totalCapacity: 0, enrolledStudentCount: 0 })).toEqual({ activeRooms: 0, capacity: 0, enrolled: 0, remaining: 0 });
    expect(schoolClassCapacity({ ...schoolClass, enrolledStudentCount: 90 }).remaining).toBe(0);
  });
  it('ne transforme pas des compteurs absents ou invalides en faux zéros', () => {
    expect(schoolClassCapacity({ ...schoolClass, classroomCount: -1, totalCapacity: NaN, enrolledStudentCount: 1.5 })).toEqual({ activeRooms: null, capacity: null, enrolled: null, remaining: null });
    const missing = { ...schoolClass } as Partial<SchoolClass>; delete missing.enrolledStudentCount;
    expect(schoolClassCapacity(missing as SchoolClass)).toEqual({ activeRooms: 2, capacity: 80, enrolled: null, remaining: null });
  });
});
