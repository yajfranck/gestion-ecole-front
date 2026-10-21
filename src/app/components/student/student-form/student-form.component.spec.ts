import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { StudentFormComponent } from './student-form.component';
import { StudentService } from '../../../service/student-service/student.service';
import { Student } from '../../../models/student/student.model';

describe('StudentFormComponent', () => {
  const api = jasmine.createSpyObj('StudentService', ['createStudent']);
  beforeEach(() => { api.createStudent.calls.reset(); api.createStudent.and.returnValue(of({ id: 'student' })); TestBed.configureTestingModule({ imports: [StudentFormComponent], providers: [providePermissionFixture(['can_student_create']), provideZonelessChangeDetection(), { provide: StudentService, useValue: api }] }); });
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
});
