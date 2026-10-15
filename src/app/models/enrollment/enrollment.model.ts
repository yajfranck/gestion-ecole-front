export interface Enrollment {
  id: string;
  establishmentId: string;
  studentId: string;
  academicYearId: string;
  schoolClassId: string;
  createdAt: string;
}

export interface ClassStudent {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
}
