import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { ClassSubjectManagerComponent } from './class-subject-manager.component';

const subject = { id: 'math', establishmentId: 'school', name: 'Mathématiques', code: 'MATH', enabled: true };
const assignment = { id: 'assignment', establishmentId: 'school', schoolClassId: 'class', subjectId: 'math', enabled: true };

describe('ClassSubjectManagerComponent', () => {
  const base = `${environment.apiUrl}/establishments/school`;
  const url = `${base}/school-years/year/classes/class/subjects`;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ClassSubjectManagerComponent], providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([]), providePermissionFixture(['can_class_subject_read', 'can_subject_read', 'can_class_subject_assign', 'can_class_subject_unassign'])] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function setup() {
    const fixture = TestBed.createComponent(ClassSubjectManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school'); fixture.componentRef.setInput('academicYearId', 'year'); fixture.componentRef.setInput('schoolClassId', 'class'); fixture.detectChanges();
    return fixture;
  }
  function loaded(assignments: unknown[] = []) {
    const fixture = setup(); http.expectOne(`${base}/subjects`).flush([subject]); http.expectOne(url).flush(assignments); fixture.detectChanges(); return fixture;
  }

  it('consulte les affectations sans charger les salles ou les élèves', () => {
    const fixture = loaded([assignment]);
    expect(fixture.nativeElement.textContent).toContain('Mathématiques');
    http.expectNone(request => request.url.endsWith('/classrooms') || request.url.endsWith('/students'));
    expect(fixture.nativeElement.querySelector('app-classroom-manager')).toBeNull();
  });

  it('affecte une matière depuis la grille et met la liste à jour sans relecture', async () => {
    const fixture = loaded(); await fixture.whenStable();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'math'; select.dispatchEvent(new Event('change')); await fixture.whenStable();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(fixture.componentInstance.busy()).toBeTrue();
    const call = http.expectOne(`${url}/math`); expect(call.request.method).toBe('PUT'); expect(call.request.body).toBeNull(); call.flush(assignment); fixture.detectChanges();
    expect(fixture.componentInstance.busy()).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="group"]').textContent).toContain('Mathématiques');
    expect(fixture.nativeElement.querySelector('select')).toBeNull(); http.expectNone(() => true);
  });

  it('confirme le retrait et conserve l’affectation après un refus serveur', () => {
    const fixture = loaded([assignment]);
    const confirm = spyOn(TestBed.inject(ConfirmationDialogService), 'confirm').and.stub();
    fixture.nativeElement.querySelector('[role="group"] button').click(); expect(confirm).toHaveBeenCalled(); http.expectNone(request => request.method === 'DELETE');
    confirm.calls.mostRecent().args[1]();
    expect(fixture.componentInstance.busy()).toBeTrue();
    http.expectOne(`${url}/math`).flush({}, { status: 409, statusText: 'Conflict' }); fixture.detectChanges();
    expect(fixture.componentInstance.busy()).toBeFalse(); expect(fixture.nativeElement.querySelector('[role="group"]').textContent).toContain('Mathématiques'); expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    fixture.nativeElement.querySelector('[role="group"] button').click(); confirm.calls.mostRecent().args[1]();
    http.expectOne(`${url}/math`).flush(null); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucune matière affectée'); http.expectNone(request => request.method === 'GET');
  });

  it('prépare plusieurs lignes sans doublonner les matières et retire une saisie sans API', () => {
    const fixture = setup();
    http.expectOne(`${base}/subjects`).flush([subject, { ...subject, id: 'french', name: 'Français' }]); http.expectOne(url).flush([]); fixture.detectChanges();
    const component = fixture.componentInstance;
    component['rows'][0].subjectId = 'math'; component['add']();
    expect(component['options'](component['rows'][1].key).map(item => item.id)).toEqual(['french']);
    component['rows'][1].subjectId = 'math'; component['save']();
    expect(component['error']()).toContain('matière différente'); http.expectNone(() => true);
    component['remove'](component['rows'][1].key); expect(component['rows'].length).toBe(1); http.expectNone(() => true);
  });

  it('reprend uniquement les affectations en échec après un succès partiel', () => {
    const fixture = setup(); http.expectOne(`${base}/subjects`).flush([subject, { ...subject, id: 'french', name: 'Français' }]); http.expectOne(url).flush([]); fixture.detectChanges();
    const component = fixture.componentInstance;
    component['rows'][0].subjectId = 'math'; component['add'](); component['rows'][1].subjectId = 'french'; component['save']();
    http.expectOne(`${url}/math`).flush(assignment);
    http.expectOne(`${url}/french`).flush({}, { status: 500, statusText: 'Error' });
    expect(component.busy()).toBeFalse(); expect(component['rows'].map(row => row.subjectId)).toEqual(['french']);
    expect(component['assignments']()).toEqual([assignment]);
    component['save'](); http.expectOne(`${url}/french`).flush({ ...assignment, id: 'assignment-french', subjectId: 'french' });
    expect(component['rows'].length).toBe(0); expect(component['assignments']().length).toBe(2); http.expectNone(() => true);
  });

  it('renvoie vers le catalogue lorsque les matières doivent être créées', () => {
    const fixture = setup(); http.expectOne(`${base}/subjects`).flush([]); http.expectOne(url).flush([]); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/establishments/school/referentials');
  });

  it('ne consulte pas les affectations sans permission', () => {
    spyOn(TestBed.inject(WorkspaceAccessService), 'hasPermission').and.returnValue(false);
    const fixture = setup(); expect(fixture.nativeElement.textContent).toContain('ne permet pas de consulter'); http.expectNone(() => true);
  });
});
