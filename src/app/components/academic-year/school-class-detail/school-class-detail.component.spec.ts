import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { SchoolClassDetailComponent } from './school-class-detail.component';

describe('SchoolClassDetailComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1`;
  const classUrl = `${base}/school-years/year-1/classes/class-1`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [SchoolClassDetailComponent],
    providers: [providePermissionFixture(['can_class_subject_read', 'can_subject_read', 'can_enrollment_read', 'can_class_subject_assign', 'can_class_subject_unassign', 'can_school_class_read'], ['school', 'school-1', 'other-school']), provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
  }));

  it('affiche les matières affectées et les élèves inscrits', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SchoolClassDetailComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.componentRef.setInput('schoolClassId', 'class-1');
    fixture.detectChanges();

    http.expectOne(`${base}/subjects`).flush([{ id: 's-1', establishmentId: 'school-1', code: 'MATH', name: 'Mathematics', enabled: true }]);
    http.expectOne(`${classUrl}/subjects`).flush([{ id: 'a-1', establishmentId: 'school-1', schoolClassId: 'class-1', subjectId: 's-1', enabled: true }]);
    http.expectOne(`${classUrl}/students`).flush([{ id: 'st-1', studentNumber: 'STU-00000001', firstName: 'Ada', lastName: 'Lovelace' }]);
    http.expectOne(`${classUrl}/classrooms`).flush([]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Mathematics');
    expect(text).toContain('Lovelace Ada');
    http.verify();
  });

  it('renvoie vers Matières quand le référentiel est vide', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SchoolClassDetailComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.componentRef.setInput('schoolClassId', 'class-1');
    fixture.detectChanges();

    http.expectOne(`${base}/subjects`).flush([]);
    http.expectOne(`${classUrl}/subjects`).flush([]);
    http.expectOne(`${classUrl}/students`).flush([]);
    http.expectOne(`${classUrl}/classrooms`).flush([]);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a[href$="/establishments/school-1/referentials"]');
    expect(link?.textContent).toContain('Matières');
    http.verify();
  });

  it('filtre les élèves par salle sans changer la classe de l’URL', () => {
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(SchoolClassDetailComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1'); fixture.componentRef.setInput('academicYearId', 'year-1'); fixture.componentRef.setInput('schoolClassId', 'class-1'); fixture.detectChanges();
    http.expectOne(`${base}/subjects`).flush([]); http.expectOne(`${classUrl}/subjects`).flush([]); http.expectOne(`${classUrl}/students`).flush([]);
    http.expectOne(`${classUrl}/classrooms`).flush([{ id: 'room', establishmentId: 'school-1', academicYearId: 'year-1', schoolClassId: 'class-1', enabled: true, code: 'A', name: 'Salle A' }]); fixture.detectChanges();
    fixture.componentInstance['classroomId'] = 'room'; fixture.componentInstance['loadStudents']();
    http.expectOne(`${classUrl}/students?classroomId=room`).flush([{ id: 'student', firstName: 'Ada', lastName: 'Exemple' }]); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Exemple Ada'); http.verify();
  });
});
