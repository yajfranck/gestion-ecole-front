import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { environment } from '../../../../environments/environment';
import { SchoolClassManagerComponent } from './school-class-manager.component';

describe('SchoolClassManagerComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1`;

  beforeEach(() => {
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
    expect(text).not.toContain('Gérer la classe');
    expect(text).toContain('Matières');
    expect(text).toContain('Salles');
    expect(text).toContain('Archiver');
    expect(text).toContain('Nouvelle classe');
    expect((fixture.nativeElement as HTMLElement).querySelector('#new-class-code')).toBeNull();
    expect(text).not.toContain('Niveau');
    http.verify();
  });

  it('conserve uniquement Actions dans la ligne et ouvre les élèves depuis le menu', () => {
    TestBed.overrideProvider(WorkspaceAccessService, { useValue: { hasPermission: (_permission: string, establishmentId: string) => establishmentId === 'school-1' } });
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1'); fixture.componentRef.setInput('academicYearId', 'year-1'); fixture.detectChanges();
    http.expectOne(`${base}/school-years/year-1/classes`).flush([{ id: 'class', establishmentId: 'school-1', academicYearId: 'year-1', code: '6A', name: 'Sixième A', enabled: true }]); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const actions = root.querySelector('tbody tr td:last-child > div')!;
    expect(actions.querySelectorAll(':scope > button').length).toBe(0);
    expect(actions.querySelectorAll('app-table-actions').length).toBe(1);
    expect(root.textContent).not.toContain('Gérer la classe');
    const menu = actions.querySelector('[popover]')!; expect(menu.matches(':popover-open')).toBeFalse();
    expect([...menu.querySelectorAll('button')].map(button => button.textContent?.trim())).toEqual(['Matières', 'Salles', 'Voir les élèves', 'Modifier', 'Archiver']);
    const trigger = actions.querySelector<HTMLButtonElement>('app-table-actions > button')!;
    trigger.click(); fixture.detectChanges();
    const students = [...menu.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Voir les élèves')!;
    students.click(); fixture.detectChanges();
    http.expectOne(`${base}/school-years/year-1/classes/class/classrooms`).flush([]);
    http.expectOne(`${base}/school-years/year-1/classes/class/students`).flush([]); fixture.detectChanges();
    expect(menu.matches(':popover-open')).toBeFalse(); expect(students.getAttribute('aria-expanded')).toBe('true');
    const panel = root.querySelector<HTMLElement>('#class-management-class')!;
    expect(students.getAttribute('aria-controls')).toBe(panel.id); expect(panel.querySelector('app-school-class-detail')).not.toBeNull();
    trigger.click(); fixture.detectChanges(); students.click(); fixture.detectChanges();
    expect(root.querySelector('#class-management-class')).toBeNull(); expect(students.getAttribute('aria-expanded')).toBe('false'); http.verify();
  });

  it('masque les commandes non autorisées dans le menu secondaire', () => {
    TestBed.overrideProvider(WorkspaceAccessService, { useValue: { hasPermission: (permission: string, establishmentId: string) => establishmentId === 'school-1' && permission === 'can_school_class_read' } });
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1'); fixture.componentRef.setInput('academicYearId', 'year-1'); fixture.detectChanges();
    http.expectOne(`${base}/school-years/year-1/classes`).flush([{ id: 'class', establishmentId: 'school-1', academicYearId: 'year-1', code: '6A', name: 'Sixième A', enabled: true }]); fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector('app-table-actions [popover]') as HTMLElement;
    expect([...menu.querySelectorAll('button')].map(button => button.textContent?.trim())).toEqual(['Salles']);
    expect(fixture.nativeElement.querySelector('button[aria-label="Gérer la classe Sixième A"]')).toBeNull(); http.verify();
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

    component['onCreated']([{ classroomCount: 0, totalCapacity: 0, enrolledStudentCount: 0, id: 'class', establishmentId: 'school-1', academicYearId: 'year-1', code: 'T-S', name: 'Terminale', enabled: true }]);
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
    const menuTrigger = root.querySelector<HTMLButtonElement>('app-table-actions > button')!; menuTrigger.click(); fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('button[aria-label="Matières de Sixième"]')!.click(); fixture.detectChanges();
    expect(root.querySelector('app-table-actions [popover]')!.matches(':popover-open')).toBeFalse();
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
    expect(root.querySelector('dialog')).toBeNull(); await Promise.resolve(); expect(document.activeElement).toBe(menuTrigger); http.verify();
  });

  it('ouvre les salles dans une seule modale avec un formulaire prérempli pour la modification', async () => {
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1'); fixture.componentRef.setInput('academicYearId', 'year-1'); fixture.detectChanges();
    http.expectOne(`${base}/school-years/year-1/classes`).flush([{ id: 'class', establishmentId: 'school-1', academicYearId: 'year-1', name: 'Sixième', code: '6', enabled: true }]); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('app-table-actions > button')!.click(); fixture.detectChanges();
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
      TestBed.overrideProvider(WorkspaceAccessService, { useValue: { hasPermission: (_permission: string, establishmentId: string) => establishmentId === 'school-1' } });
    });

    function setup() {
      const fixture = TestBed.createComponent(SchoolClassManagerComponent);
      fixture.componentRef.setInput('establishmentId', 'school-1'); fixture.componentRef.setInput('academicYearId', 'year-1'); fixture.detectChanges();
      return fixture;
    }

    it('affiche les trois indicateurs de la liste avec un seul appel, sans charger les salles ni les inscriptions', () => {
      const fixture = setup(); const http = TestBed.inject(HttpTestingController);
      const annual = `${base}/school-years/year-1`;
      const classes = ['a', 'b', 'c'].map((id, index) => ({ id, establishmentId: 'school-1', academicYearId: 'year-1', code: id.toUpperCase(), name: `Classe ${id}`, enabled: true, classroomCount: index === 2 ? 0 : 1, totalCapacity: index === 0 ? 10 : index === 1 ? 1 : 0, enrolledStudentCount: index === 0 ? 9 : index === 1 ? 1 : 0 }));
      http.expectOne(`${annual}/classes`).flush(classes); fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      expect([...root.querySelectorAll('thead th')].map(th => th.textContent?.trim())).toEqual(['Classe', 'Code', 'Série', 'Élèves inscrits', 'Salles actives', 'Places restantes', 'Actions']);
      const rows = root.querySelectorAll('tbody > tr'); expect(rows[0].querySelectorAll('td').length).toBe(6);
      expect(rows[0].querySelector('[data-label="Élèves inscrits"]')?.textContent?.trim()).toBe('9');
      expect(rows[0].querySelector('[data-label="Salles actives"]')?.textContent?.trim()).toBe('1');
      expect(rows[0].querySelector('[data-label="Places restantes"]')?.textContent).toContain('Presque pleine');
      expect(rows[1].querySelector('[data-label="Places restantes"]')?.textContent).toContain('Complète'); expect(rows[2].textContent).toContain('Aucune salle');
      const room = { id: 'room-a', establishmentId: 'school-1', academicYearId: 'year-1', schoolClassId: 'a', enabled: true, code: 'A', name: 'Salle A', maxStudents: 20 };
      fixture.componentInstance['updateClassrooms']('a', [room, { ...room, id: 'foreign', establishmentId: 'other' }]); fixture.detectChanges();
      expect(rows[0].querySelector('[data-label="Places restantes"]')?.textContent).toContain('11'); expect(rows[0].textContent).not.toContain('Presque pleine');
      fixture.componentInstance['searchTerm'].set('Classe a'); fixture.detectChanges(); expect(root.querySelectorAll('tbody > tr').length).toBe(1);
      http.expectNone(() => true); http.verify();
    });

    it('actualise la liste et ses indicateurs avec un seul nouvel appel', () => {
      const fixture = setup(); const http = TestBed.inject(HttpTestingController); const url = `${base}/school-years/year-1/classes`;
      const schoolClass = { id: 'a', establishmentId: 'school-1', academicYearId: 'year-1', code: 'A', name: 'Classe A', enabled: true, classroomCount: 1, totalCapacity: 40, enrolledStudentCount: 10 };
      http.expectOne(url).flush([schoolClass]); fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      [...root.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Actualiser les indicateurs')!.click();
      http.expectOne(url).flush([{ ...schoolClass, classroomCount: 2, totalCapacity: 60, enrolledStudentCount: 20 }]); fixture.detectChanges();
      expect(root.querySelector('[data-label="Élèves inscrits"]')?.textContent?.trim()).toBe('20');
      expect(root.querySelector('[data-label="Salles actives"]')?.textContent?.trim()).toBe('2');
      expect(root.querySelector('[data-label="Places restantes"]')?.textContent?.trim()).toMatch(/^40/); http.expectNone(() => true); http.verify();
    });

    it('affiche les compteurs avec la seule permission de consultation des classes', () => {
      TestBed.overrideProvider(WorkspaceAccessService, { useValue: { hasPermission: (permission: string, establishmentId: string) => establishmentId === 'school-1' && permission === 'can_school_class_read' } });
      const fixture = setup(); const http = TestBed.inject(HttpTestingController);
      http.expectOne(`${base}/school-years/year-1/classes`).flush([{ id: 'a', establishmentId: 'school-1', academicYearId: 'year-1', code: 'A', name: 'Classe A', enabled: true, classroomCount: 1, totalCapacity: 40, enrolledStudentCount: 10 }]); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-label="Élèves inscrits"]').textContent.trim()).toBe('10');
      expect(fixture.nativeElement.querySelector('[data-label="Places restantes"]').textContent.trim()).toMatch(/^30/); http.expectNone(() => true); http.verify();
    });

    it('ne déclenche aucun appel de repli si un compteur manque dans la réponse', () => {
      const fixture = setup(); const http = TestBed.inject(HttpTestingController);
      http.expectOne(`${base}/school-years/year-1/classes`).flush([{ id: 'a', establishmentId: 'school-1', academicYearId: 'year-1', code: 'A', name: 'Classe A', enabled: true, classroomCount: 1, totalCapacity: 40 }]); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-label="Élèves inscrits"]').textContent.trim()).toBe('—');
      expect(fixture.nativeElement.querySelector('[data-label="Places restantes"]').textContent.trim()).toMatch(/^—/); http.expectNone(() => true); http.verify();
    });

    it('propose une reprise si la lecture de la liste échoue', () => {
      const fixture = setup(); const http = TestBed.inject(HttpTestingController); const url = `${base}/school-years/year-1/classes`;
      http.expectOne(url).flush({}, { status: 500, statusText: 'Error' }); fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement; expect(root.querySelector('[role="alert"]')).not.toBeNull();
      [...root.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Réessayer')!.click();
      http.expectOne(url).flush([]); fixture.detectChanges(); expect(root.querySelector('[role="alert"]')).toBeNull(); http.expectNone(() => true); http.verify();
    });
  });
});
