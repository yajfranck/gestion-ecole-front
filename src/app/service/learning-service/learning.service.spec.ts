import { provideHttpClient, withInterceptors, HttpEventType } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../../core/auth.interceptor';
import { AuthService } from '../../core/auth.service';
import { LearningService, learningFileError } from './learning.service';

describe('LearningService', () => {
  let service: LearningService;
  let http: HttpTestingController;
  const scope = { establishmentId: 'school', academicYearId: 'year', schoolClassId: 'class' };
  const base = `${environment.apiUrl}/establishments/school/school-years/year/classes/class/learning-content`;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: AuthService, useValue: { session: signal({ accessToken: 'private-token', tokenType: 'Bearer' }) } }] });
    service = TestBed.inject(LearningService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('utilise le filtre et la pagination serveur', () => {
    service.list(scope, 'ASSIGNMENT', 2).subscribe();
    const request = http.expectOne((item) => item.url === base);
    expect(request.request.params.get('type')).toBe('ASSIGNMENT');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('size')).toBe('20');
    request.flush({ contents: [], page: 2, size: 20, totalElements: 0 });
  });

  it('utilise exclusivement les routes parent en consultation', () => {
    service.list({ establishmentId: 'school', studentId: 'child', academicYearId: 'year' }, '', 0).subscribe();
    const request = http.expectOne((item) => item.url === `${environment.apiUrl}/establishments/school/guardians/me/children/child/school-years/year/learning-content`);
    expect(request.request.params.has('type')).toBeFalse();
    request.flush({ contents: [], page: 0, size: 20, totalElements: 0 });
    expect(() => service.save({ establishmentId: 'school', studentId: 'child', academicYearId: 'year' }, { type: 'LESSON', title: 'Titre', description: null, body: null, subjectId: 'subject', dueDate: null })).toThrowError('Espace parent en lecture seule.');
  });

  it('crée et remplace un contenu avec sa matière dans la classe de l’URL', () => {
    const body = { type: 'ASSIGNMENT' as const, title: 'Fractions', subjectId: 'subject', description: null, body: null, dueDate: '2026-11-02' };
    service.save(scope, body).subscribe();
    const create = http.expectOne(base);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(body);
    create.flush({});

    service.save(scope, body, 'content').subscribe();
    const update = http.expectOne(`${base}/content`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual(body);
    update.flush({});
  });

  it('publie le brouillon sans corps ni paramètres supplémentaires', () => {
    service.transition(scope, 'content', 'publish').subscribe();
    const request = http.expectOne(`${base}/content/publish`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    expect(request.request.params.keys()).toEqual([]);
    request.flush({});
  });

  it('envoie le fichier dans le champ multipart file', () => {
    const file = new File(['PDF'], 'cours.pdf', { type: 'application/pdf' });
    service.upload(scope, 'content', file).subscribe();
    const request = http.expectOne(`${base}/content/attachments`);
    expect(request.request.body.get('file')).toEqual(file);
    expect(request.request.headers.get('Authorization')).toBe('Bearer private-token');
    request.event({ type: HttpEventType.UploadProgress, loaded: 2, total: 3 });
    request.flush({ id: 'file' });
  });

  it('télécharge un blob authentifié sans jeton dans l’URL', () => {
    service.download(scope, 'content', 'file').subscribe((blob) => expect(blob.size).toBe(3));
    const request = http.expectOne(`${base}/content/attachments/file`);
    expect(request.request.responseType).toBe('blob');
    expect(request.request.headers.get('Authorization')).toBe('Bearer private-token');
    expect(request.request.urlWithParams).not.toContain('private-token');
    request.flush(new Blob(['PDF']));
  });

  it('refuse les fichiers vides, trop volumineux et les MIME incompatibles', () => {
    expect(learningFileError(new File([], 'vide.pdf', { type: 'application/pdf' }))).toBeTruthy();
    expect(learningFileError(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'grand.pdf', { type: 'application/pdf' }))).toBeTruthy();
    expect(learningFileError(new File(['x'], 'fichier.pdf', { type: 'text/plain' }))).toBeTruthy();
    expect(learningFileError(new File(['x'], 'cours.txt', { type: 'text/plain' }))).toBeNull();
  });
});
