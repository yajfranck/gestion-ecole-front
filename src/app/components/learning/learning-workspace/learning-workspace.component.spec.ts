import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject as ResponseSubject, throwError } from 'rxjs';
import { LearningWorkspaceComponent } from './learning-workspace.component';
import { LearningService } from '../../../service/learning-service/learning.service';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { GuardianService } from '../../../service/guardian-service/guardian.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { LicenseAccessService } from '../../../core/license-access.service';
import { PendingChangesService } from '../../../shared/pending-changes.service';
import { LearningContent } from '../../../models/learning/learning.model';
import { SchoolClassSubject } from '../../../models/subject/subject.model';
import { SubjectService } from '../../../service/subject-service/subject.service';

describe('LearningWorkspaceComponent', () => {
  const api = jasmine.createSpyObj('LearningService', ['list', 'get', 'save', 'attachments', 'upload', 'download', 'transition']);
  const access = { authorities: signal(['can_learning_content_read']), hasPermission: jasmine.createSpy('hasPermission') };
  const license = { canUse: jasmine.createSpy('canUse'), decision: () => 'allowed' };
  const guardian = { getMyChildren: jasmine.createSpy('getMyChildren') };
  const subjectService = jasmine.createSpyObj('SubjectService', ['getSubjects', 'getClassSubjects']);
  const subject = { id: 'math', establishmentId: 'school', code: 'MATH', name: 'Mathématiques', enabled: true };
  const assignment = { id: 'assignment', establishmentId: 'school', schoolClassId: 'class', subjectId: subject.id, enabled: true };
  const item = { id: 'content', establishmentId: 'school', academicYearId: 'year', schoolClassId: 'class', type: 'LESSON', title: 'Fractions', description: '', body: 'Contenu', subjectId: subject.id, dueDate: null, status: 'DRAFT' } as LearningContent;
  const params = { establishmentId: 'school', academicYearId: 'year' };
  const routeParams = new BehaviorSubject(convertToParamMap(params));
  beforeEach(() => {
    routeParams.next(convertToParamMap(params));
    for (const method of Object.values(api)) (method as jasmine.Spy).calls.reset();
    access.authorities.set(['can_learning_content_read']);
    access.hasPermission.and.returnValue(true);
    license.canUse.and.returnValue(true);
    api.list.and.returnValue(of({ contents: [item], totalElements: 1, page: 0, size: 20 }));
    api.get.and.returnValue(of(item));
    api.attachments.and.returnValue(of([]));
    api.save.and.returnValue(of(item));
    api.upload.and.returnValue(of({ type: HttpEventType.Response, body: { id: 'attachment' } }));
    api.transition.and.returnValue(of(item));
    guardian.getMyChildren.and.returnValue(of([{ id: 'child' }]));
    subjectService.getSubjects.calls.reset();
    subjectService.getClassSubjects.calls.reset();
    subjectService.getSubjects.and.returnValue(of([subject]));
    subjectService.getClassSubjects.and.returnValue(of([assignment]));
    TestBed.configureTestingModule({ imports: [LearningWorkspaceComponent], providers: [provideZonelessChangeDetection(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: routeParams, snapshot: { queryParamMap: convertToParamMap({}) } } },
      { provide: LearningService, useValue: api }, { provide: GuardianService, useValue: guardian },
      { provide: SubjectService, useValue: subjectService },
      { provide: WorkspaceAccessService, useValue: access }, { provide: LicenseAccessService, useValue: license },
      { provide: AcademicYearService, useValue: { getClasses: () => of([{ id: 'class', establishmentId: 'school', academicYearId: 'year', enabled: true, name: '6e' }]) } }] });
    const context = TestBed.inject(WorkspaceContextService);
    context.current.set({ establishmentId: 'school', establishmentName: 'École', academicYearId: 'year', academicYearName: '2026-2027' });
    context.academicYear.set({ id: 'year', establishmentId: 'school', name: '2026-2027', startsOn: '2026-09-01', endsOn: '2027-06-30', enabled: true });
  });

  async function create() {
    const fixture = TestBed.createComponent(LearningWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance['selectClass']('class');
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('charge le contexte exact, filtre et pagine côté serveur', async () => {
    const fixture = await create();
    fixture.componentInstance['type'] = 'ASSIGNMENT';
    fixture.componentInstance['load'](1);
    expect(api.list).toHaveBeenCalledWith({ establishmentId: 'school', academicYearId: 'year', schoolClassId: 'class' }, 'ASSIGNMENT', 1);
  });

  it('refuse la consultation directe sans permission de lecture', async () => {
    access.hasPermission.and.returnValue(false);
    const fixture = await create();
    expect(api.list).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('non autorisée');
  });

  it('masque les actions sans permission et capacité', async () => {
    license.canUse.and.returnValue(false);
    const fixture = await create();
    expect(fixture.nativeElement.textContent).not.toContain('Nouveau contenu');
    fixture.componentInstance['edit']();
    expect(fixture.componentInstance['editing']()).toBeFalse();
  });

  it('charge détail et pièces jointes seulement à la consultation', async () => {
    const fixture = await create();
    expect(api.attachments).not.toHaveBeenCalled();
    fixture.componentInstance['open'](item);
    expect(api.get).toHaveBeenCalledWith(jasmine.any(Object), 'content');
    expect(api.attachments).toHaveBeenCalledWith(jasmine.any(Object), 'content');
  });

  it('conserve la saisie et les fichiers lors d’un conflit', async () => {
    api.save.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    const fixture = await create();
    const component = fixture.componentInstance;
    component['edit']();
    component['draft'].title = 'Ma saisie';
    component['draft'].subjectId = subject.id;
    component['change']();
    component['save']();
    expect(component['draft'].title).toBe('Ma saisie');
    expect(component['editing']()).toBeTrue();
    expect(TestBed.inject(PendingChangesService).dirty()).toBeTrue();
    expect(component['error']()).toContain('Conflit');
  });

  it('ne change pas de classe après refus d’abandonner une saisie', async () => {
    const fixture = await create();
    fixture.componentInstance['edit']();
    fixture.componentInstance['draft'].title = 'Saisie';
    fixture.componentInstance['change']();
    spyOn(window, 'confirm').and.returnValue(false);
    fixture.componentInstance['selectClass']('other');
    expect(fixture.componentInstance['classId']()).toBe('class');
    expect(fixture.componentInstance['draft'].title).toBe('Saisie');
    const event = new Event('beforeunload', { cancelable: true });
    fixture.componentInstance.beforeUnload(event as BeforeUnloadEvent);
    expect(event.defaultPrevented).toBeTrue();
  });

  it('conserve un upload échoué et réutilise l’identifiant créé au nouvel essai', async () => {
    api.upload.and.returnValue(throwError(() => new HttpErrorResponse({ status: 413 })));
    const fixture = await create();
    const component = fixture.componentInstance;
    component['edit']();
    component['draft'].title = 'Titre';
    component['draft'].subjectId = subject.id;
    const file = new File(['PDF'], 'cours.pdf', { type: 'application/pdf' });
    component['files'].set([file]);
    component['change']();
    component['save']();
    expect(component['selected']()?.id).toBe('content');
    expect(component['files']()).toEqual([file]);
    expect(component['editing']()).toBeTrue();
    component['save']();
    expect(api.save.calls.mostRecent().args[2]).toBe('content');
  });

  it('ne publie qu’après une action explicite et autorisée', async () => {
    const fixture = await create();
    expect(api.transition).not.toHaveBeenCalled();
    spyOn(window, 'confirm').and.returnValue(true);
    fixture.componentInstance['transition'](item, 'publish');
    expect(api.transition).toHaveBeenCalledWith(jasmine.any(Object), 'content', 'publish');
  });

  it('expose uniquement la consultation dans le parcours parent', async () => {
    access.authorities.set(['can_guardian_read_children']);
    routeParams.next(convertToParamMap({ studentId: 'child', academicYearId: 'year' }));
    const fixture = TestBed.createComponent(LearningWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(api.list).toHaveBeenCalledWith({ studentId: 'child', academicYearId: 'year' }, '', 0);
    expect(fixture.nativeElement.textContent).not.toContain('Nouveau contenu');
    expect(fixture.componentInstance['allowed']('create')).toBeFalse();
    expect(subjectService.getClassSubjects).not.toHaveBeenCalled();
  });

  for (const type of ['LESSON', 'ASSIGNMENT'] as const) {
    it(`exige une matière de la classe pour enregistrer un ${type}`, async () => {
      const fixture = await create();
      const component = fixture.componentInstance;
      component['edit']();
      component['draft'].title = ' Fractions ';
      component['draft'].type = type;
      component['save']();
      expect(api.save).not.toHaveBeenCalled();
      expect(component['error']()).toContain('matière active affectée');

      component['draft'].subjectId = subject.id;
      component['draft'].dueDate = '2026-11-02';
      component['save']();
      expect(api.save).toHaveBeenCalledWith(
        { establishmentId: 'school', academicYearId: 'year', schoolClassId: 'class' },
        jasmine.objectContaining({ title: 'Fractions', type, subjectId: subject.id, dueDate: type === 'ASSIGNMENT' ? '2026-11-02' : null }),
        undefined
      );
    });
  }

  it('propose les noms des seules matières actives affectées à la classe', async () => {
    subjectService.getSubjects.and.returnValue(of([
      subject, { ...subject, id: 'unassigned', name: 'Non affectée' },
      { ...subject, id: 'archived', name: 'Archivée', enabled: false },
      { ...subject, id: 'other', name: 'Autre établissement', establishmentId: 'other' }
    ]));
    subjectService.getClassSubjects.and.returnValue(of([
      assignment, { ...assignment, id: 'a-2', subjectId: 'archived' },
      { ...assignment, id: 'a-3', subjectId: 'other' }
    ]));
    const fixture = await create();
    fixture.componentInstance['edit']();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(subjectService.getClassSubjects).toHaveBeenCalledOnceWith('school', 'year', 'class');
    const select = fixture.nativeElement.querySelector('select[name="subjectId"]') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual(['Choisir une matière de la classe', 'Mathématiques · MATH']);
    select.value = subject.id;
    select.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance['draft'].subjectId).toBe(subject.id);
  });

  it('préserve la matière à la modification et envoie l’identifiant du contenu existant', async () => {
    const fixture = await create();
    fixture.componentInstance['open'](item);
    fixture.componentInstance['edit'](item);
    fixture.componentInstance['save']();
    expect(api.save).toHaveBeenCalledWith(jasmine.any(Object), jasmine.objectContaining({ subjectId: subject.id }), item.id);
  });

  it('bloque un contenu dont la matière a été retirée de la classe', async () => {
    subjectService.getClassSubjects.and.returnValue(of([]));
    const fixture = await create();
    fixture.componentInstance['open'](item);
    fixture.componentInstance['edit'](item);
    fixture.componentInstance['save']();
    fixture.detectChanges();

    expect(api.save).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Aucune matière active');
    expect(fixture.componentInstance['draft'].subjectId).toBe(subject.id);
  });

  it('permet de recharger les matières après un refus API sans perdre la saisie', async () => {
    subjectService.getClassSubjects.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const fixture = await create();
    const component = fixture.componentInstance;
    component['edit']();
    component['draft'].title = 'Saisie conservée';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Impossible de charger les matières');

    subjectService.getClassSubjects.and.returnValue(of([assignment]));
    fixture.nativeElement.querySelector('.state-retry').click();
    fixture.detectChanges();
    expect(component['subjectsError']()).toBeNull();
    expect(component['draft'].title).toBe('Saisie conservée');
    expect(component['subjects']()).toEqual([subject]);
  });

  it('ignore les anciennes matières après un changement de classe', async () => {
    const response = new ResponseSubject<SchoolClassSubject[]>();
    subjectService.getClassSubjects.and.returnValue(response);
    const fixture = await create();
    const component = fixture.componentInstance;
    component['edit']();
    expect(component['subjectsLoading']()).toBeTrue();
    component['classes'].update((classes) => [...classes, { ...classes[0], id: 'other-class' }]);
    component['selectClass']('other-class');
    response.next([assignment]);
    response.complete();
    expect(component['subjects']()).toEqual([]);
    expect(component['classId']()).toBe('other-class');
  });

  it('explique un refus de publication après retrait de la matière', async () => {
    api.transition.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    const fixture = await create();
    fixture.componentInstance['open'](item);
    spyOn(window, 'confirm').and.returnValue(true);
    fixture.componentInstance['transition'](item, 'publish');
    expect(fixture.componentInstance['error']()).toContain('y compris lors de la publication');
    expect(fixture.componentInstance['selected']()).toEqual(item);
    expect(TestBed.inject(PendingChangesService).saving()).toBeFalse();
  });
});
