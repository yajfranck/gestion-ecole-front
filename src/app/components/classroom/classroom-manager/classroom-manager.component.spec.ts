import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { withPermissionChecks } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ClassroomManagerComponent } from './classroom-manager.component';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { environment } from '../../../../environments/environment';

describe('ClassroomManagerComponent', () => {
  const access = { authorities: signal(['can_school_class_read', 'can_school_class_create', 'can_school_class_update', 'can_school_class_delete']), has: (permission: string) => access.authorities().includes(permission), hasPermission: (permission: string) => access.authorities().includes(permission) };
  const url = `${environment.apiUrl}/establishments/school/school-years/year/classes/class/classrooms`;
  const room = { id: 'room', establishmentId: 'school', academicYearId: 'year', schoolClassId: 'class', code: 'A', name: 'Sixième A', maxStudents: 40, enabled: true };
  beforeEach(() => { access.authorities.set(['can_school_class_read', 'can_school_class_create', 'can_school_class_update', 'can_school_class_delete']); TestBed.configureTestingModule({ imports: [ClassroomManagerComponent], providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), { provide: WorkspaceAccessService, useValue: withPermissionChecks(access) }] }); });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function create() {
    const fixture = TestBed.createComponent(ClassroomManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school'); fixture.componentRef.setInput('academicYearId', 'year'); fixture.componentRef.setInput('schoolClassId', 'class'); fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(url).flush([room, { ...room, id: 'foreign', schoolClassId: 'other' }]); fixture.detectChanges(); return fixture;
  }
  it('affiche la capacité et exclut les salles d’une autre classe', () => {
    const fixture = create(); expect(fixture.componentInstance['rooms']()).toEqual([room]); expect(fixture.nativeElement.textContent).toContain('40 places maximum');
  });
  it('renomme une salle dans sa classe et recharge la liste', () => {
    const fixture = create(); const component = fixture.componentInstance;
    component['edit'](room); component['code'] = ' a '; component['name'] = ' Sixième A '; component['maxStudents'] = 38; component['save']();
    const http = TestBed.inject(HttpTestingController); const request = http.expectOne(`${url}/room`);
    expect(request.request.method).toBe('PATCH'); expect(request.request.body).toEqual({ code: 'A', name: 'Sixième A', maxStudents: 38 }); request.flush({}); http.expectOne(url).flush([{ ...room, code: 'A', name: 'Sixième A', maxStudents: 38 }]);
    expect(component['editingId']).toBeNull(); expect(component['rooms']()[0].name).toBe('Sixième A');
  });
  it('explique le refus d’archiver une salle référencée sans la retirer de l’écran', () => {
    const fixture = create(); spyOn(TestBed.inject(ConfirmationDialogService), 'confirm').and.callFake((_message, accept) => accept()); fixture.componentInstance['archive'](room);
    TestBed.inject(HttpTestingController).expectOne(`${url}/room`).flush(null, { status: 409, statusText: 'Conflict' });
    expect(fixture.componentInstance['error']()).toContain('Déplacez les élèves'); expect(fixture.componentInstance['rooms']()).toEqual([room]);
  });
  it('refuse une création sans permission', () => {
    access.authorities.set(['can_school_class_read']); const fixture = create(); fixture.componentInstance['code'] = 'B'; fixture.componentInstance['name'] = 'Salle B'; fixture.componentInstance['save']();
    TestBed.inject(HttpTestingController).expectNone((request) => request.method === 'POST'); expect(fixture.nativeElement.textContent).not.toContain('Ajouter une salle');
  });

  it('crée une salle en envoyant sa capacité', () => {
    const fixture = create(); const component = fixture.componentInstance;
    component['code'] = 'B'; component['name'] = 'Sixième B'; component['maxStudents'] = 32; component['save']();
    const request = TestBed.inject(HttpTestingController).expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ code: 'B', name: 'Sixième B', maxStudents: 32 });
    request.flush({});
    TestBed.inject(HttpTestingController).expectOne(url).flush([{ ...room }, { ...room, id: 'room-b', code: 'B', name: 'Sixième B', maxStudents: 32 }]);
  });
});
