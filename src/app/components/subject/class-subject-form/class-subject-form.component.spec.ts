import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { Employee } from '../../../models/employee/employee.model';
import { ClassSubjectFormComponent } from './class-subject-form.component';

const subject = {
  id: 'math',
  establishmentId: 'school',
  createdAt: '',
  updatedAt: '',
  name: 'Mathématiques',
  enabled: true,
};
const room = {
  id: 'a',
  establishmentId: 'school',
  academicYearId: 'year',
  schoolClassId: 'class',
  code: 'A',
  name: 'Salle A',
  enabled: true,
  maxStudents: 40,
};
const employee: Employee = {
  id: 'person',
  establishmentId: 'school',
  firstName: 'Ada',
  lastName: 'Exemple',
  employeeNumber: 'P1',
  email: 'ada@example.org',
  positionId: 'position',
  positionName: 'Personnel',
  enabled: true,
  loginEnabled: false,
  establishmentAdmin: false,
  directRoleCodes: ['STAFF'],
  roles: ['STAFF'],
  createdAt: '',
  updatedAt: '',
};
const assignment = {
  id: 'assignment',
  establishmentId: 'school',
  schoolClassId: 'class',
  subjectId: 'math',
  enabled: true,
  classroomTeachers: [{ classroomId: 'a', employeeId: 'person' }],
};

describe('ClassSubjectFormComponent', () => {
  const url = `${environment.apiUrl}/establishments/school/school-years/year/classes/class/subjects/math`;
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [ClassSubjectFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function create(editing = false) {
    const fixture = TestBed.createComponent(ClassSubjectFormComponent);
    fixture.componentRef.setInput('establishmentId', 'school');
    fixture.componentRef.setInput('academicYearId', 'year');
    fixture.componentRef.setInput('schoolClassId', 'class');
    fixture.componentRef.setInput('subjects', [subject]);
    fixture.componentRef.setInput('classrooms', [
      room,
      { ...room, id: 'b', code: 'B' },
      { ...room, id: 'foreign-room', schoolClassId: 'other' },
    ]);
    fixture.componentRef.setInput('employees', [
      employee,
      { ...employee, id: 'disabled', enabled: false },
      { ...employee, id: 'foreign-person', establishmentId: 'other' },
    ]);
    fixture.componentRef.setInput('canConfigureTeachers', true);
    if (editing) fixture.componentRef.setInput('assignment', assignment);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('conserve les enseignants lors d’une affectation sans configuration du personnel', () => {
    const { component, http } = create();
    component['selectedSubjectId'] = 'math';
    component['save']();
    const request = http.expectOne(url);
    expect(request.request.body).toBeNull();
    request.flush(assignment);
  });

  it('permet à une même personne active, même sans compte activé, d’enseigner dans deux salles', () => {
    const { component, http } = create();
    component['selectedSubjectId'] = 'math';
    component['configureTeachers'] = true;
    component['teacherByClassroom'] = { a: 'person', b: 'person' };
    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);
    component['save']();
    const request = http.expectOne(url);
    const classroomTeachers = [
      { classroomId: 'a', employeeId: 'person' },
      { classroomId: 'b', employeeId: 'person' },
    ];
    expect(request.request.body).toEqual({ classroomTeachers });
    request.flush({ ...assignment, classroomTeachers });
    expect(saved).toHaveBeenCalledWith(jasmine.objectContaining({ classroomTeachers }));
  });

  it('retire tous les enseignants en envoyant une liste vide, tout en conservant la matière', () => {
    const { component, http } = create(true);
    component['teacherByClassroom'] = {};
    component['save']();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ classroomTeachers: [] });
    request.flush({ ...assignment, classroomTeachers: [] });
  });

  for (const id of ['disabled', 'foreign-person']) {
    it(`refuse le personnel inactif ou hors périmètre : ${id}`, () => {
      const { component, http } = create(true);
      component['teacherByClassroom'] = { a: id };
      component['save']();
      http.expectNone(url);
      expect(component['error']()).toContain('actifs de cet établissement');
    });
  }

  it('ne remplace pas les affectations si la liste du personnel ne peut pas être chargée', () => {
    const { fixture, component, http } = create(true);
    fixture.componentRef.setInput('employeesError', 'Accès refusé');
    fixture.detectChanges();
    component['save']();
    http.expectNone(url);
    expect(component['teacherByClassroom']).toEqual({ a: 'person' });
  });

  it('conserve la saisie après une erreur et bloque les doubles soumissions', () => {
    const { component, http } = create(true);
    component['save']();
    component['save']();
    const request = http.expectOne(url);
    request.flush({}, { status: 409, statusText: 'Conflict' });
    expect(component['teacherByClassroom']).toEqual({ a: 'person' });
    expect(component['saving']()).toBeFalse();
    expect(component['error']()).toContain('Actualisez');
  });
});
