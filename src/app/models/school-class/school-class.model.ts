import { ClassroomRequest } from '../classroom/classroom.model';

export interface SchoolClass {
  id: string;
  establishmentId: string;
  academicYearId: string;
  code: string;
  name: string;
  series?: string | null;
  enabled: boolean;
}

export type SchoolClassRequest = Pick<SchoolClass, 'code' | 'name' | 'series'>;

export interface CreateSchoolClassRequest extends SchoolClassRequest {
  classrooms: ClassroomRequest[];
}
