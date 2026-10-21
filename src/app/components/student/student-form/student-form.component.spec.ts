import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { StudentFormComponent } from './student-form.component';
import { StudentService } from '../../../service/student-service/student.service';
import { Student } from '../../../models/student/student.model';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';

describe('StudentFormComponent', () => {
  const api = jasmine.createSpyObj('StudentService', ['createStudent', 'updateStudent']);
  const student: Student = { id: 'student', establishmentId: 'school', studentNumber: 'STU-1', firstName: 'Ada', lastName: 'Lovelace', enabled: true };
  beforeEach(() => { api.createStudent.calls.reset(); api.updateStudent.calls.reset(); api.createStudent.and.returnValue(of({ id: 'student' })); TestBed.configureTestingModule({ imports: [StudentFormComponent], providers: [providePermissionFixture(['can_student_create', 'can_student_update']), provideZonelessChangeDetection(), { provide: StudentService, useValue: api }] }); });
  function create() { const fixture = TestBed.createComponent(StudentFormComponent); fixture.componentRef.setInput('establishmentId', 'school'); fixture.detectChanges(); return fixture.componentInstance; }
  it('valide les champs avant de créer un dossier sans numéro fourni par le client', () => {
    const component = create(); component['firstName'] = '   '; component['lastName'] = 'Nom'; component['save'](); expect(api.createStudent).not.toHaveBeenCalled();
    component['firstName'] = ' Ada '; component['lastName'] = ' Lovelace '; component['save'](); expect(api.createStudent).toHaveBeenCalledOnceWith('school', { firstName: 'Ada', lastName: 'Lovelace' });
  });
  it('conserve la saisie après une erreur et permet de refuser l’abandon', () => {
    api.createStudent.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 }))); const component = create(); component['firstName'] = 'Ada'; component['lastName'] = 'Lovelace'; component['save']();
    expect(component['firstName']).toBe('Ada'); expect(component['error']()).toBeTruthy(); spyOn(TestBed.inject(ConfirmationDialogService), 'confirm').and.stub(); expect(component.canClose()).toBeFalse();
  });
  it('bloque les doubles envois et la fermeture pendant l’enregistrement', () => {
    const response = new Subject<Student>(); api.createStudent.and.returnValue(response); const component = create(); component['firstName'] = 'Ada'; component['lastName'] = 'Lovelace'; component['save'](); component['save'](); expect(api.createStudent).toHaveBeenCalledTimes(1); expect(component.canClose()).toBeFalse();
  });

  it('valide et transmet la date de naissance facultative', () => {
    const component = create();
    component['firstName'] = 'Ada'; component['lastName'] = 'Exemple';
    component['dateOfBirth'] = '9999-12-31'; component['save']();
    expect(api.createStudent).not.toHaveBeenCalled();
    component['dateOfBirth'] = '2016-02-29'; component['save']();
    expect(api.createStudent).toHaveBeenCalledOnceWith('school', { firstName: 'Ada', lastName: 'Exemple', dateOfBirth: '2016-02-29' });
    expect(component['dateOfBirth']).toBe('');
  });

  function edit() {
    const fixture = TestBed.createComponent(StudentFormComponent);
    fixture.componentRef.setInput('establishmentId', 'school');
    fixture.componentRef.setInput('student', student);
    fixture.detectChanges();
    return fixture;
  }

  it('préremplit le dossier et modifie uniquement le champ corrigé sans créer d’élève', () => {
    const fixture = edit(); const component = fixture.componentInstance;
    const updated = jasmine.createSpy('updated'); component.updated.subscribe(updated);
    expect(component.snapshot()).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    expect(fixture.nativeElement.textContent).toContain('Modification du dossier STU-1');
    expect(fixture.nativeElement.querySelector('input[type="date"]')).toBeNull();
    api.updateStudent.and.returnValue(of({ ...student, firstName: 'Augusta' }));
    component['firstName'] = ' Augusta '; component['save']();
    expect(api.updateStudent).toHaveBeenCalledOnceWith('school', 'student', { firstName: 'Augusta' });
    expect(api.createStudent).not.toHaveBeenCalled();
    expect(updated).toHaveBeenCalledWith({ ...student, firstName: 'Augusta' });
  });

  it('continue sans écriture lorsque l’identité est inchangée', () => {
    const component = edit().componentInstance;
    const updated = jasmine.createSpy('updated'); component.updated.subscribe(updated);
    expect(component.canClose()).toBeTrue();
    component['save']();
    expect(updated).toHaveBeenCalledOnceWith(student);
    expect(api.updateStudent).not.toHaveBeenCalled(); expect(api.createStudent).not.toHaveBeenCalled();
  });

  it('conserve les corrections après un refus et interdit les mises à jour sans permission', () => {
    const fixture = edit(); const component = fixture.componentInstance;
    component['lastName'] = 'Byron';
    api.updateStudent.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    component['save']();
    expect(component.snapshot().lastName).toBe('Byron');
    expect(component['error']()).toBeTruthy(); expect(component.saving()).toBeFalse();
    spyOn(TestBed.inject(WorkspaceAccessService), 'hasPermission').and.returnValue(false);
    component['save']();
    expect(api.updateStudent).toHaveBeenCalledTimes(1); expect(api.createStudent).not.toHaveBeenCalled();
    expect(edit().nativeElement.querySelector('form')).toBeNull();
  });
});
