import { HttpClient, HttpEventType } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LearningAttachment, LearningContent, LearningPage, LearningRequest, LearningScope, LearningType } from '../../models/learning/learning.model';

export const learningFileTypes: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

export function learningFileError(file: File): string | null {
  if (!file.size || file.size > 10 * 1024 * 1024) return 'Le fichier doit contenir entre 1 octet et 10 Mio.';
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return learningFileTypes[extension] === file.type ? null : 'Format ou type MIME non autorisé.';
}

@Injectable({ providedIn: 'root' })
export class LearningService {
  private readonly http = inject(HttpClient);

  list(scope: LearningScope, type: LearningType | '', page: number, size = 20) {
    return this.http.get<LearningPage>(this.base(scope), { params: { ...(type ? { type } : {}), page, size } });
  }

  get(scope: LearningScope, id: string) {
    return this.http.get<LearningContent>(`${this.base(scope)}/${id}`);
  }

  save(scope: LearningScope, request: LearningRequest, id?: string) {
    if ('studentId' in scope) throw new Error('Espace parent en lecture seule.');
    return id ? this.http.put<LearningContent>(`${this.base(scope)}/${id}`, request)
      : this.http.post<LearningContent>(this.base(scope), request);
  }

  transition(scope: LearningScope, id: string, action: 'publish' | 'archive') {
    if ('studentId' in scope) throw new Error('Espace parent en lecture seule.');
    return this.http.post<LearningContent>(`${this.base(scope)}/${id}/${action}`, null);
  }

  attachments(scope: LearningScope, id: string) {
    return this.http.get<LearningAttachment[]>(`${this.base(scope)}/${id}/attachments`);
  }

  upload(scope: LearningScope, id: string, file: File) {
    if ('studentId' in scope) throw new Error('Espace parent en lecture seule.');
    const error = learningFileError(file);
    if (error) throw new Error(error);
    const form = new FormData();
    form.append('file', file);
    return this.http.post<LearningAttachment>(`${this.base(scope)}/${id}/attachments`, form, { observe: 'events', reportProgress: true });
  }

  download(scope: LearningScope, id: string, attachmentId: string) {
    return this.http.get(`${this.base(scope)}/${id}/attachments/${attachmentId}`, { responseType: 'blob' });
  }

  private base(scope: LearningScope): string {
    const root = environment.apiUrl;
    return 'studentId' in scope
      ? `${root}/guardians/me/children/${scope.studentId}/school-years/${scope.academicYearId}/learning-content`
      : `${root}/establishments/${scope.establishmentId}/school-years/${scope.academicYearId}/classes/${scope.schoolClassId}/learning-content`;
  }
}
