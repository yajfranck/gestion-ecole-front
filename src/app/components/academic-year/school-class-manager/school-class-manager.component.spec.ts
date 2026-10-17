import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { SchoolClassManagerComponent } from './school-class-manager.component';

describe('SchoolClassManagerComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [SchoolClassManagerComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
  }));

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
    expect(text).toContain('Matières et élèves');
    expect(text).toContain('Archiver');
    expect(text).toContain('Ajouter une classe');
    expect(text).not.toContain('Niveau');
    http.verify();
  });

  it('crée une classe avec sa première salle et permet de retirer sa série', () => {
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1'); fixture.componentRef.setInput('academicYearId', 'year-1'); fixture.detectChanges();
    const url = `${base}/school-years/year-1/classes`; http.expectOne(url).flush([]);
    const component = fixture.componentInstance; component['newCode'] = 'T-S'; component['newName'] = 'Terminale'; component['newSeries'] = ' Scientifique ';
    component['newClassroomCode'] = ' a '; component['newClassroomName'] = 'Salle A'; component['newClassroomMaxStudents'] = 40; component['create']();
    const create = http.expectOne(url); expect(create.request.body).toEqual({ code: 'T-S', name: 'Terminale', series: 'Scientifique', classrooms: [{ code: 'A', name: 'Salle A', maxStudents: 40 }] }); create.flush({}); http.expectOne(url).flush([]);
    const schoolClass = { id: 'class', establishmentId: 'school-1', academicYearId: 'year-1', code: 'T-S', name: 'Terminale', series: 'Scientifique', enabled: true };
    component['startEditing'](schoolClass); component['series'] = ''; component['save'](schoolClass);
    const update = http.expectOne(`${url}/class`); expect(update.request.method).toBe('PATCH'); expect(update.request.body.series).toBe(''); update.flush({}); http.expectOne(url).flush([]); http.verify();
  });

  it('n’envoie pas la création si la première salle a une capacité invalide', () => {
    const http = TestBed.inject(HttpTestingController); const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1'); fixture.componentRef.setInput('academicYearId', 'year-1'); fixture.detectChanges();
    const url = `${base}/school-years/year-1/classes`; http.expectOne(url).flush([]);
    const component = fixture.componentInstance;
    component['newCode'] = 'CP-A'; component['newName'] = 'CP A'; component['newClassroomCode'] = 'A'; component['newClassroomName'] = 'Salle A'; component['newClassroomMaxStudents'] = 0;
    component['create']();
    http.expectNone((request) => request.method === 'POST');
    expect(component['createError']()).toContain('capacité');
  });
});
