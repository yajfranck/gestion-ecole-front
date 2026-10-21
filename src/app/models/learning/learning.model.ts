export type LearningType = 'LESSON' | 'ASSIGNMENT';
export type LearningStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface LearningRequest {
  type: LearningType;
  title: string;
  description: string | null;
  body: string | null;
  subjectId: string;
  dueDate: string | null;
}

export interface LearningContent extends LearningRequest {
  id: string;
  establishmentId: string;
  academicYearId: string;
  schoolClassId: string;
  status: LearningStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearningPage {
  contents: LearningContent[];
  totalElements: number;
  page: number;
  size: number;
}

export interface LearningAttachment {
  id: string;
  contentId: string;
  fileName: string;
  mediaType: string;
  size: number;
  createdAt: string;
}

export type LearningScope = { establishmentId: string; studentId: string; academicYearId: string } |
  { establishmentId: string; academicYearId: string; schoolClassId: string };
