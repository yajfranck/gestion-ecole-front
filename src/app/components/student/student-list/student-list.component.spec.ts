import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { StudentListComponent } from './student-list.component';

describe('StudentListComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/students`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [StudentListComponent],
    providers: [providePermissionFixture(['can_academic_year_read', 'can_school_class_read', 'can_student_read', 'can_student_create', 'can_student_update', 'can_student_delete', 'can_guardian_read', 'can_enrollment_create', 'can_tuition_read']),
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ establishmentId: 'school-1' }), queryParamMap: convertToParamMap({}) } } }
    ]
  }));

  it('liste les élèves de l’établissement sans notion d’inscription', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(StudentListComponent);
    fixture.detectChanges();
    http.expectOne(url).flush([{ id: 'st-1', establishmentId: 'school-1', studentNumber: 'STU-00000001', firstName: 'Ada', lastName: 'Lovelace', enabled: true }]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Fiche et tuteurs');
    expect(text).not.toContain('À inscrire');
    http.verify();
  });

  it('indique l’absence d’élève', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(StudentListComponent);
    fixture.detectChanges();
    http.expectOne(url).flush([{ id: 'st-1', establishmentId: 'school-1', studentNumber: 'STU-1', firstName: 'Ada', lastName: 'Lovelace', enabled: true }]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('a[href*="enrollments"]')).toBeNull();
    http.verify();
  });

  it('propose inscription et situation financière lorsqu’une année de cet établissement est sélectionnée', () => {
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment({ id: 'school-1', code: 'S1', name: 'École', enabled: true, createdAt: '', updatedAt: '' });
    context.selectAcademicYear({ id: 'year-1', establishmentId: 'school-1', name: '2026-2027', startsOn: '2026-09-01', endsOn: '2027-06-30', enabled: true });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(StudentListComponent);
    fixture.detectChanges();
    http.expectOne(url).flush([{ id: 'st-1', establishmentId: 'school-1', studentNumber: 'STU-1', firstName: 'Ada', lastName: 'Lovelace', enabled: true }]);
    fixture.detectChanges();

    const hrefs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/establishments/school-1/school-years/year-1/enrollments?studentId=st-1');
    expect(hrefs).toContain('/establishments/school-1/school-years/year-1/finance?studentId=st-1');
    http.verify();
  });

  it('indique l’absence d’élève', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(StudentListComponent);
    fixture.detectChanges();
    http.expectOne(url).flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucun élève enregistré');
    http.verify();
  });

  it('suit la structure commune : titre de section compact, état vide, bouton de création sous la liste', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(StudentListComponent);
    fixture.detectChanges();
    http.expectOne(url).flush([]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.section-header h2.section-title')?.textContent).toContain('Élèves');
    expect(root.querySelector('.state-empty')).toBeTruthy();
    expect(root.querySelector('.section-header')?.compareDocumentPosition(root.querySelector('app-form-modal') as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    http.verify();
  });
});
