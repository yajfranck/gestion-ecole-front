export interface Classroom {
  id: string;
  establishmentId: string;
  academicYearId: string;
  schoolClassId: string;
  code: string;
  name: string;
  maxStudents: number;
  enabled: boolean;
}

export type ClassroomRequest = Pick<Classroom, 'code' | 'name' | 'maxStudents'>;
