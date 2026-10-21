import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ClassroomManagerComponent } from './classroom-manager.component';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { environment } from '../../../../environments/environment';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { providePermissionFixture } from '../../../testing/permission-fixture';

const room = { id: 'room', establishmentId: 'school', academicYearId: 'year', schoolClassId: 'class', code: 'A', name: 'Sixième A', maxStudents: 40, enabled: true };
const roomB = { ...room, id: 'room-b', code: 'B', name: 'Sixième B', maxStudents: 32 };

describe('ClassroomManagerComponent', () => {
  const url = `${environment.apiUrl}/establishments/school/school-years/year/classes/class/classrooms`;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ClassroomManagerComponent], providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), providePermissionFixture(['can_school_class_read', 'can_school_class_create', 'can_school_class_update', 'can_school_class_delete'])] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function create(rooms: unknown[] = [room, { ...room, id: 'foreign', schoolClassId: 'other' }]) {
    const fixture = TestBed.createComponent(ClassroomManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school'); fixture.componentRef.setInput('academicYearId', 'year'); fixture.componentRef.setInput('schoolClassId', 'class'); fixture.detectChanges();
    http.expectOne(url).flush(rooms); fixture.detectChanges(); return fixture;
  }

  it('préremplit les salles dans une grille commune et exclut les autres classes', async () => {
    const fixture = create(); await fixture.whenStable();
    expect(fixture.componentInstance['rows'].map(row => row.saved)).toEqual([room]);
    expect([...fixture.nativeElement.querySelectorAll('input')].map((input: HTMLInputElement) => input.value)).toEqual(['A', 'Sixième A', '40']);
    expect(fixture.nativeElement.querySelectorAll('app-form-rows').length).toBe(1);
    expect(fixture.nativeElement.querySelector('button[aria-label="Archiver la salle Sixième A"] svg')).not.toBeNull();
  });

  it('modifie une salle sur sa ligne et ne renvoie pas les lignes inchangées', () => {
    const fixture = create([room, roomB]); const component = fixture.componentInstance;
    component['rows'][0].code = ' a '; component['rows'][0].name = ' Salle A '; component['rows'][0].maxStudents = 38;
    component['save'](); const request = http.expectOne(`${url}/room`);
    expect(request.request.method).toBe('PATCH'); expect(request.request.body).toEqual({ code: 'A', name: 'Salle A', maxStudents: 38 });
    request.flush({ ...room, name: 'Salle A', maxStudents: 38 });
    expect(component['rows'][0].saved?.name).toBe('Salle A'); expect(component.saving()).toBeFalse();
    component['save'](); http.expectNone(() => true);
  });

  it('ajoute et retire une ligne sans appel API avant enregistrement', () => {
    const fixture = create(); const component = fixture.componentInstance;
    component['add'](); component['add'](); expect(component['rows'].length).toBe(3);
    component['remove'](component['rows'][1]); expect(component['rows'].length).toBe(2);
    http.expectNone(() => true);
    component['remove'](component['rows'][1]); expect(component['rows'].length).toBe(1);
  });

  it('valide toutes les lignes et les doublons avant tout envoi', () => {
    const component = create().componentInstance;
    component['add'](); Object.assign(component['rows'][1], { code: 'A', name: 'Salle B', maxStudents: 32 });
    component['save'](); expect(component['error']()).toContain('code différent'); http.expectNone(() => true);
    component['rows'][1].code = 'B'; component['rows'][1].maxStudents = 1.5;
    component['save'](); expect(component['error']()).toContain('capacité entière'); http.expectNone(() => true);
  });

  it('conserve les succès partiels et reprend seulement la salle en échec', () => {
    const fixture = create([]); const component = fixture.componentInstance;
    Object.assign(component['rows'][0], { code: 'B', name: 'Sixième B', maxStudents: 32 }); component['add']();
    Object.assign(component['rows'][1], { code: 'C', name: 'Sixième C', maxStudents: 30 }); component['save']();
    const first = http.expectOne(url); expect(first.request.method).toBe('POST'); first.flush(roomB);
    const second = http.expectOne(url); expect(second.request.body.code).toBe('C'); second.flush({}, { status: 409, statusText: 'Conflict' });
    expect(component.saving()).toBeFalse(); expect(component['rows'][0].saved?.id).toBe('room-b'); expect(component['rows'][1].code).toBe('C');
    component['save'](); const retry = http.expectOne(url); expect(retry.request.body.code).toBe('C'); retry.flush({ ...roomB, id: 'room-c', code: 'C', name: 'Sixième C', maxStudents: 30 });
    expect(component['rows'].every(row => !!row.saved)).toBeTrue(); http.expectNone(() => true);
  });

  it('confirme l’archivage et conserve la salle et les saisies après un refus', () => {
    const component = create().componentInstance; component['add'](); component['rows'][1].name = 'En préparation';
    const confirmation = spyOn(TestBed.inject(ConfirmationDialogService), 'confirm').and.stub();
    component['remove'](component['rows'][0]); expect(confirmation).toHaveBeenCalled(); http.expectNone(() => true);
    confirmation.calls.mostRecent().args[1](); http.expectOne(`${url}/room`).flush(null, { status: 409, statusText: 'Conflict' });
    expect(component['error']()).toContain('Déplacez les élèves'); expect(component['rows'].length).toBe(2); expect(component['rows'][1].name).toBe('En préparation');
    component['remove'](component['rows'][0]); confirmation.calls.mostRecent().args[1](); http.expectOne(`${url}/room`).flush(null);
    expect(component['rows'].length).toBe(1); expect(component['rows'][0].name).toBe('En préparation');
  });

  it('respecte les permissions de consultation seule', async () => {
    spyOn(TestBed.inject(WorkspaceAccessService), 'hasPermission').and.callFake(permission => permission === 'can_school_class_read');
    const fixture = create(); await fixture.whenStable(); const component = fixture.componentInstance;
    component['add'](); component['rows'][0].name = 'Non autorisé'; component['save'](); component['remove'](component['rows'][0]);
    expect(component['rows'].length).toBe(1); http.expectNone(() => true);
    expect(fixture.nativeElement.querySelector('input').readOnly).toBeTrue();
    expect(fixture.nativeElement.textContent).not.toContain('Ajouter une salle');
    expect(fixture.nativeElement.querySelector('button[title="Archiver la salle"]')).toBeNull();
  });
});
