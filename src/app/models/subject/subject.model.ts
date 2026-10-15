export interface Subject {
  id: string;
  establishmentId: string;
  code: string;
  name: string;
  enabled: boolean;
}

export type SubjectRequest = Pick<Subject, 'code' | 'name'>;

export interface SchoolClassSubject {
  id: string;
  establishmentId: string;
  schoolClassId: string;
  subjectId: string;
  enabled: boolean;
}
