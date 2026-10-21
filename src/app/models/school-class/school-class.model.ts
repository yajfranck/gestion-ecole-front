export interface SchoolClass {
  id: string;
  establishmentId: string;
  academicYearId: string;
  code: string;
  name: string;
  series?: string | null;
  enabled: boolean;
  classroomCount: number;
  totalCapacity: number;
  enrolledStudentCount: number;
}

export type SchoolClassRequest = Pick<SchoolClass, 'code' | 'name' | 'series'>;

export type CreateSchoolClassRequest = SchoolClassRequest;

export interface CreateSchoolClassesRequest {
  classes: CreateSchoolClassRequest[];
}
