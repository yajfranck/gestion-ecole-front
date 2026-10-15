import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { StudentListComponent } from './student-list.component';

describe('StudentListComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/students`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [StudentListComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ establishmentId: 'school-1' }) } } }
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
    http.expectOne(url).flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucun élève enregistré');
    http.verify();
  });

  it('suit la structure commune : titre de section compact, état vide, création sous la liste', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(StudentListComponent);
    fixture.detectChanges();
    http.expectOne(url).flush([]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.section-header h2.section-title')?.textContent).toContain('Élèves');
    expect(root.querySelector('.state-empty')).toBeTruthy();
    expect(root.querySelector('.section-header')?.compareDocumentPosition(root.querySelector('details') as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    http.verify();
  });
});
