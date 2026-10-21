import { providePermissionFixture } from '../../../testing/permission-fixture';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AcademicYearFormComponent } from './academic-year-form.component';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';

describe('AcademicYearFormComponent', () => {
  const api = jasmine.createSpyObj('AcademicYearService', ['createAcademicYear']);
  beforeEach(() => { api.createAcademicYear.calls.reset(); api.createAcademicYear.and.returnValue(of({ id: 'year' })); TestBed.configureTestingModule({ imports: [AcademicYearFormComponent], providers: [providePermissionFixture(['can_academic_year_create'], ['school', 'school-1', 'other-school']), provideZonelessChangeDetection(), { provide: AcademicYearService, useValue: api }] }); });
  function create() { const fixture = TestBed.createComponent(AcademicYearFormComponent); fixture.componentRef.setInput('establishmentId', 'school'); fixture.detectChanges(); const component = fixture.componentInstance; component['name'] = ' 2026-2027 '; component['startsOn'] = '2026-09-01'; component['endsOn'] = '2027-06-30'; return component; }
  it('enregistre le nom et les dates dans le bon établissement', () => { const component = create(); component['save'](); expect(api.createAcademicYear).toHaveBeenCalledOnceWith('school', { name: '2026-2027', startsOn: '2026-09-01', endsOn: '2027-06-30' }); });
  it('refuse les dates inversées sans requête', () => { const component = create(); component['endsOn'] = '2026-08-01'; component['save'](); expect(api.createAcademicYear).not.toHaveBeenCalled(); expect(component['error']()).toBeTruthy(); });
  it('conserve les champs après un conflit', () => { api.createAcademicYear.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 }))); const component = create(); component['save'](); expect(component['name']).toBe(' 2026-2027 '); expect(component['error']()).toContain('existe déjà'); });
  it('ne double pas la création pendant une requête', () => { api.createAcademicYear.and.returnValue(new Subject<AcademicYear>()); const component = create(); component['save'](); component['save'](); expect(api.createAcademicYear).toHaveBeenCalledTimes(1); });
  it('exige des dates couvrant aujourd’hui uniquement pendant la configuration obligatoire', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date(2027, 8, 1, 12));
      const fixture = TestBed.createComponent(AcademicYearFormComponent);
      fixture.componentRef.setInput('establishmentId', 'school');
      fixture.componentRef.setInput('requireCurrentYear', true);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component['name'] = '2026-2027'; component['startsOn'] = '2026-09-01'; component['endsOn'] = '2027-06-30';
      component['save']();
      expect(api.createAcademicYear).not.toHaveBeenCalled();
      expect(component['error']()).toContain('aujourd’hui');
      component['name'] = '2027-2028'; component['startsOn'] = '2027-09-01'; component['endsOn'] = '2028-06-30';
      component['save']();
      expect(api.createAcademicYear).toHaveBeenCalledOnceWith('school', { name: '2027-2028', startsOn: '2027-09-01', endsOn: '2028-06-30' });
    } finally { jasmine.clock().uninstall(); }
  });
});
