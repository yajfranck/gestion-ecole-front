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
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
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
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Mathematics');
    expect(text).toContain('Lovelace Ada');
    http.verify();
  });

  it('renvoie vers Matières et niveaux quand le référentiel est vide', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SchoolClassDetailComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.componentRef.setInput('schoolClassId', 'class-1');
    fixture.detectChanges();

    http.expectOne(`${base}/subjects`).flush([]);
    http.expectOne(`${classUrl}/subjects`).flush([]);
    http.expectOne(`${classUrl}/students`).flush([]);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a[href$="/establishments/school-1/referentials"]');
    expect(link?.textContent).toContain('Matières et niveaux');
    http.verify();
  });
});
