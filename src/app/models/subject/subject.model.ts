export interface Subject {
  id: string;
  establishmentId: string;
  code?: string | null;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  enabled: boolean;
  classroomTeachers?: { classroomId: string; employeeId: string }[];
}

export interface CreateSubjectRequest {
  name: string;
  code?: string;
}

export interface CreateSubjectsRequest {
  subjects: CreateSubjectRequest[];
}

export interface UpdateSubjectRequest {
  name: string;
  code: string;
}

export interface SchoolClassSubject {
  id: string;
  establishmentId: string;
  schoolClassId: string;
  subjectId: string;
  enabled: boolean;
  classroomTeachers?: { classroomId: string; employeeId: string }[];
}
