import { SchoolClass } from '../models/school-class/school-class.model';
import { SchoolClassCapacity } from '../models/school-class/school-class-capacity.model';

/** Présentation des agrégats de /classes, sans lecture complémentaire. */
export function schoolClassCapacity(schoolClass: SchoolClass): SchoolClassCapacity {
  const count = (value: number): number | null => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const enrolled = count(schoolClass.enrolledStudentCount);
  const capacity = count(schoolClass.totalCapacity);
  return {
    enrolled,
    activeRooms: count(schoolClass.classroomCount),
    capacity,
    remaining: capacity !== null && enrolled !== null ? Math.max(0, capacity - enrolled) : null
  };
}
