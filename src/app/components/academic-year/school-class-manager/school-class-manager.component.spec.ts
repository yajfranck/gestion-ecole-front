import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { SchoolClassCapacityService } from '../../../service/school-class-capacity-service/school-class-capacity.service';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { environment } from '../../../../environments/environment';
import { SchoolClassManagerComponent } from './school-class-manager.component';

describe('SchoolClassManagerComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1`;

  beforeEach(() => {
    TestBed.overrideComponent(SchoolClassManagerComponent, { set: { providers: [{ provide: SchoolClassCapacityService, useValue: { indicators: signal({}), loading: signal(false), error: signal(false), load: jasmine.createSpy('load'), setClassrooms: jasmine.createSpy('setClassrooms') } }] } });
    TestBed.configureTestingModule({
    imports: [SchoolClassManagerComponent],
    providers: [providePermissionFixture(['can_school_class_create', 'can_school_class_read', 'can_school_class_update', 'can_school_class_delete', 'can_class_subject_read', 'can_subject_read', 'can_class_subject_assign', 'can_class_subject_unassign']), provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
  });

  it('affiche les classes avec leurs actions', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();

    http.expectOne(`${base}/school-years/year-1/classes`).flush([
      { id: 'c-1', establishmentId: 'school-1', academicYearId: 'year-1', code: 'P1-A', name: 'Primary 1 A', enabled: true }
    ]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Primary 1 A');
    expect(text).toContain('Détails');
    expect(text).toContain('Matières');
    expect(text).toContain('Salles');
    expect(text).toContain('Archiver');
    expect(text).toContain('Nouvelle classe');
    expect((fixture.nativeElement as HTMLElement).querySelector('#new-class-code')).toBeNull();
    expect(text).not.toContain('Niveau');
    http.verify();
  });

  it('filtre les classes par série sans modifier la liste source', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();
    http.expectOne(`${base}/school-years/year-1/classes`).flush([
      { id: 'c-1', establishmentId: 'school-1', academicYearId: 'year-1', code: 'T-S', name: 'Terminale S', series: 'Scientifique', enabled: true },
      { id: 'c-2', establishmentId: 'school-1', academicYearId: 'year-1', code: 'T-L', name: 'Terminale L', series: 'Littéraire', enabled: true }
    ]);

    fixture.componentInstance['selectedSeries'].set('Littéraire');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Terminale L');
    expect(text).not.toContain('Terminale S');
    expect(fixture.componentInstance['classes']()).toHaveSize(2);
    http.verify();
  });

  it('ne réutilise pas une permission accordée dans un autre établissement', () => {
    TestBed.overrideProvider(WorkspaceAccessService, { useValue: {
      hasPermission: (permission: string, establishmentId: string) => establishmentId === 'other-school'
        && ['can_school_class_read', 'can_school_class_create'].includes(permission)
    } });
    const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('consultation de cette liste n’est pas autorisée');
    expect(text).not.toContain('Nouvelle classe');
    TestBed.inject(HttpTestingController).verify();
  });

  it('ouvre le formulaire sans salle, puis actualise la liste après création', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();
    const url = `${base}/school-years/year-1/classes`;
    http.expectOne(url).flush([]);
    const component = fixture.componentInstance;
    component['openCreate']();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-school-class-form')).not.toBeNull();
    expect(element.querySelector('#new-class-code')).not.toBeNull();
    expect(element.querySelector('#new-classroom-code')).toBeNull();

    component['onCreated']([{ id: 'class', establishmentId: 'school-1', academicYearId: 'year-1', code: 'T-S', name: 'Terminale', enabled: true }]);
    http.expectOne(url).flush([]);
    expect(component['createOpen']()).toBeFalse();
    expect(component['successMessage']()).toContain('Ajoutez ses salles');
    http.verify();
  });

  it('préremplit la modification et permet de retirer la série depuis le formulaire', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();
    const url = `${base}/school-years/year-1/classes`;
    const schoolClass = { id: 'class', establishmentId: 'school-1', academicYearId: 'year-1', code: 'T-S', name: 'Terminale', series: 'Scientifique', enabled: true };
    http.expectOne(url).flush([schoolClass]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const edit = [...element.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Modifier')!;
    edit.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const form = element.querySelector('dialog form')!;
    const fields = [...form.querySelectorAll('input')];
    expect(fields.map(field => field.value)).toEqual(['T-S', 'Terminale', 'Scientifique']);
    fields[2].value = '';
    fields[2].dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const update = http.expectOne(`${url}/class`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ code: 'T-S', name: 'Terminale', series: '' });
    update.flush({});
    http.expectOne(url).flush([]);
    http.verify();
  });

  it('ouvre les matières et leur formulaire dans une modale dédiée sans charger les salles', async () => {
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1'); fixture.componentRef.setInput('academicYearId', 'year-1'); fixture.detectChanges();
    const schoolClass = { id: 'class', establishmentId: 'school-1', academicYearId: 'year-1', name: 'Sixième', code: '6', enabled: true };
    http.expectOne(`${base}/school-years/year-1/classes`).flush([schoolClass]); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button[aria-label="Matières de Sixième"]')!.click(); fixture.detectChanges();
    const subject = { id: 'math', establishmentId: 'school-1', name: 'Mathématiques', code: 'MATH', enabled: true };
    http.expectOne(`${base}/subjects`).flush([subject]); http.expectOne(`${base}/school-years/year-1/classes/class/subjects`).flush([]); fixture.detectChanges(); await fixture.whenStable();
    expect(root.querySelector('dialog h2')!.textContent).toBe('Matières · Sixième');
    expect(root.querySelector('dialog app-class-subject-manager app-form-rows')).not.toBeNull(); expect(root.querySelector('app-classroom-manager')).toBeNull();
    http.expectNone(request => request.url.endsWith('/classrooms') || request.url.endsWith('/students'));
    const select = root.querySelector<HTMLSelectElement>('dialog select')!; select.value = 'math'; select.dispatchEvent(new Event('change')); await fixture.whenStable();
    root.querySelector('dialog form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); fixture.detectChanges();
    expect(root.querySelector<HTMLButtonElement>('dialog button[aria-label="Fermer la fenêtre"]')!.disabled).toBeTrue();
    root.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })); fixture.detectChanges(); expect(root.querySelector('dialog')).not.toBeNull();
    http.expectOne(`${base}/school-years/year-1/classes/class/subjects/math`).flush({ id: 'assignment', establishmentId: 'school-1', schoolClassId: 'class', subjectId: 'math', enabled: true }); fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('dialog button[aria-label="Fermer la fenêtre"]')!.click(); fixture.detectChanges();
    expect(root.querySelector('dialog')).toBeNull(); http.verify();
  });

  it('ouvre les salles dans une seule modale avec un formulaire prérempli pour la modification', async () => {
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1'); fixture.componentRef.setInput('academicYearId', 'year-1'); fixture.detectChanges();
    http.expectOne(`${base}/school-years/year-1/classes`).flush([{ id: 'class', establishmentId: 'school-1', academicYearId: 'year-1', name: 'Sixième', code: '6', enabled: true }]); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button[aria-label="Salles de Sixième"]')!.click(); fixture.detectChanges();
    const url = `${base}/school-years/year-1/classes/class/classrooms`;
    const room = { id: 'room', establishmentId: 'school-1', academicYearId: 'year-1', schoolClassId: 'class', name: 'Salle A', code: 'A', maxStudents: 40, enabled: true };
    http.expectOne(url).flush([room]); fixture.detectChanges(); await fixture.whenStable();
    expect(root.querySelectorAll('dialog').length).toBe(1); expect(root.querySelector('app-class-subject-manager')).toBeNull();
    http.expectNone(request => request.url.endsWith('/subjects') || request.url.endsWith('/students'));
    const inputs = [...root.querySelectorAll<HTMLInputElement>('dialog form input')]; expect(inputs.map(input => input.value)).toEqual(['A', 'Salle A', '40']);
    inputs[2].value = '38'; inputs[2].dispatchEvent(new Event('input')); await fixture.whenStable();
    root.querySelector('dialog form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); fixture.detectChanges();
    const patch = http.expectOne(`${url}/room`); expect(patch.request.method).toBe('PATCH'); expect(patch.request.body).toEqual({ code: 'A', name: 'Salle A', maxStudents: 38 });
    fixture.componentInstance['closeManagement'](); fixture.detectChanges(); expect(root.querySelector('dialog')).not.toBeNull();
    patch.flush({}, { status: 409, statusText: 'Conflict' }); fixture.detectChanges();
    expect(root.querySelector<HTMLButtonElement>('dialog button[aria-label="Fermer la fenêtre"]')!.disabled).toBeFalse(); expect(root.querySelectorAll('dialog').length).toBe(1); expect(inputs[2].value).toBe('38'); http.verify();
  });
  describe('indicateurs de capacité', () => {
    beforeEach(() => {
      TestBed.overrideComponent(SchoolClassManagerComponent, { set: { providers: [SchoolClassCapacityService] } });
      TestBed.overrideProvider(WorkspaceAccessService, { useValue: { hasPermission: (_permission: string, establishmentId: string) => establishmentId === 'school-1' } });
    });

    function setup() {
      const fixture = TestBed.createComponent(SchoolClassManagerComponent);
      fixture.componentRef.setInput('establishmentId', 'school-1'); fixture.componentRef.setInput('academicYearId', 'year-1'); fixture.detectChanges();
      return fixture;
    }

    it('affiche les trois indicateurs et distingue les classes pleines, presque pleines et sans salle', () => {
      const fixture = setup(); const http = TestBed.inject(HttpTestingController);
      const annual = `${base}/school-years/year-1`;
      const classes = ['a', 'b', 'c'].map(id => ({ id, establishmentId: 'school-1', academicYearId: 'year-1', code: id.toUpperCase(), name: `Classe ${id}`, enabled: true }));
      http.expectOne(`${annual}/classes`).flush(classes);
      const room = { id: 'room-a', establishmentId: 'school-1', academicYearId: 'year-1', schoolClassId: 'a', enabled: true, code: 'A', name: 'Salle A', maxStudents: 10 };
      http.expectOne(`${annual}/enrollments`).flush([...Array.from({ length: 9 }, (_, i) => ({ id: `e-${i}`, establishmentId: 'school-1', academicYearId: 'year-1', schoolClassId: 'a', classroomId: 'room-a', studentId: `s-${i}` })), { id: 'e-b', establishmentId: 'school-1', academicYearId: 'year-1', schoolClassId: 'b', classroomId: 'room-b', studentId: 's-b' }]);
      http.expectOne(`${annual}/classes/a/classrooms`).flush([room]); http.expectOne(`${annual}/classes/b/classrooms`).flush([{ ...room, id: 'room-b', schoolClassId: 'b', maxStudents: 1 }]); http.expectOne(`${annual}/classes/c/classrooms`).flush([]); fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      expect([...root.querySelectorAll('thead th')].map(th => th.textContent?.trim())).toEqual(['Classe', 'Code', 'Série', 'Élèves inscrits', 'Salles actives', 'Places restantes', 'Actions']);
      const rows = root.querySelectorAll('tbody > tr'); expect(rows[0].querySelectorAll('td').length).toBe(6);
      expect(rows[0].querySelector('[data-label="Élèves inscrits"]')?.textContent?.trim()).toBe('9');
      expect(rows[0].querySelector('[data-label="Salles actives"]')?.textContent?.trim()).toBe('1');
      expect(rows[0].querySelector('[data-label="Places restantes"]')?.textContent).toContain('Presque pleine');
      expect(rows[1].querySelector('[data-label="Places restantes"]')?.textContent).toContain('Complète'); expect(rows[2].textContent).toContain('Aucune salle');
      fixture.componentInstance['updateClassrooms']('a', [{ ...room, maxStudents: 20 }]); fixture.detectChanges();
      expect(rows[0].querySelector('[data-label="Places restantes"]')?.textContent).toContain('11'); expect(rows[0].textContent).not.toContain('Presque pleine');
      fixture.componentInstance['searchTerm'].set('Classe a'); fixture.detectChanges(); expect(root.querySelectorAll('tbody > tr').length).toBe(1); http.expectNone(() => true); http.verify();
    });

    it('affiche un état indisponible et permet de recharger les indicateurs', () => {
      const fixture = setup(); const http = TestBed.inject(HttpTestingController); const annual = `${base}/school-years/year-1`;
      http.expectOne(`${annual}/classes`).flush([{ id: 'a', establishmentId: 'school-1', academicYearId: 'year-1', code: 'A', name: 'Classe A', enabled: true }]);
      http.expectOne(`${annual}/enrollments`).flush({}, { status: 500, statusText: 'Error' }); http.expectOne(`${annual}/classes/a/classrooms`).flush([]); fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('[data-label="Élèves inscrits"]')?.textContent).toContain('—'); expect(root.querySelector('[role="alert"]')?.textContent).toContain('indisponibles');
      [...root.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Actualiser les indicateurs')!.click();
      http.expectOne(`${annual}/enrollments`).flush([]); http.expectOne(`${annual}/classes/a/classrooms`).flush([]); fixture.detectChanges();
      expect(root.querySelector('[role="alert"]')).toBeNull(); expect(root.querySelector('[data-label="Élèves inscrits"]')?.textContent?.trim()).toBe('0'); http.verify();
    });
  });

});
