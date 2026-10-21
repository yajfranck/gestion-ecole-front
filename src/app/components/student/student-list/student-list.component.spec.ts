import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { StudentListComponent } from './student-list.component';

describe('StudentListComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1/students`;
  const student = { id: 'st-1', establishmentId: 'school-1', studentNumber: 'STU-00000001', firstName: 'Adèle', lastName: 'Lovelace', enabled: true };
  beforeEach(() => TestBed.configureTestingModule({
    imports: [StudentListComponent], providers: [providePermissionFixture(['can_student_read', 'can_student_create', 'can_student_update', 'can_student_delete', 'can_guardian_read', 'can_guardian_link', 'can_guardian_unlink']),
      provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ establishmentId: 'school-1' }), queryParamMap: convertToParamMap({}) } } }]
  }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function create(students = [student]) {
    const fixture = TestBed.createComponent(StudentListComponent); fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(base).flush(students); fixture.detectChanges(); return fixture;
  }

  it('réserve le menu à la consultation même avec tous les droits de mutation', () => {
    const root = create().nativeElement as HTMLElement;
    expect(root.textContent).toContain('Adèle Lovelace');
    expect(root.textContent).toContain('Voir le dossier');
    expect(root.querySelector('app-student-form, app-form-modal')).toBeNull();
    expect(root.textContent).not.toContain('Ajouter un élève');
    expect(root.querySelector('a[href*="enrollments"]')).toBeNull();
  });

  it('recherche par identité sans accents ou par numéro sans modifier les données sources', () => {
    const fixture = create(); const component = fixture.componentInstance;
    component['searchTerm'].set('adele'); fixture.detectChanges();
    expect(component['filteredStudents']()).toHaveSize(1);
    component['searchTerm'].set('STU-00000001'); expect(component['filteredStudents']()).toHaveSize(1);
    component['searchTerm'].set('inconnu'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucun élève ne correspond');
    expect(component['students']()).toHaveSize(1);
  });

  it('affiche l’identité et les tuteurs en modale sans mutation possible', () => {
    const fixture = create(); const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click(); fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${base}/st-1`).flush(student);
    http.expectOne(`${base}/st-1/guardians`).flush([{ id: 'guardian', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org' }]); fixture.detectChanges();
    expect(root.querySelector('dialog')!.textContent).toContain('STU-00000001');
    expect(root.querySelector('dialog')!.textContent).toContain('grace@example.org');
    expect(root.querySelector('dialog form')).toBeNull();
    expect(root.querySelector('dialog')!.textContent).not.toContain('Lier un tuteur');
    expect(root.querySelector('dialog')!.textContent).not.toContain('Retirer');
    http.expectNone(request => request.method !== 'GET');
  });

  it('ouvre la fiche demandée dans l’URL', () => {
    const route = TestBed.inject(ActivatedRoute) as unknown as { snapshot: { queryParamMap: unknown } };
    route.snapshot.queryParamMap = convertToParamMap({ studentId: 'st-1' });
    const fixture = create();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${base}/st-1`).flush(student); http.expectOne(`${base}/st-1/guardians`).flush([]); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')).not.toBeNull();
  });

  it('oriente les nouveaux dossiers vers les inscriptions lorsque le catalogue est vide', () => {
    const fixture = create([]);
    expect(fixture.nativeElement.textContent).toContain('Aucun élève enregistré');
    expect(fixture.nativeElement.textContent).toContain('menu Inscriptions');
  });
});
