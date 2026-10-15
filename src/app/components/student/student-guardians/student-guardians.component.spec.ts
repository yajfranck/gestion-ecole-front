import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { StudentGuardiansComponent } from './student-guardians.component';

describe('StudentGuardiansComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/students/student-1`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [StudentGuardiansComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
  }));

  it('affiche la fiche de l’élève et ses tuteurs', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(StudentGuardiansComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('studentId', 'student-1');
    fixture.detectChanges();

    http.expectOne(url).flush({ id: 'student-1', establishmentId: 'school-1', studentNumber: 'STU-00000001', firstName: 'Ada', lastName: 'Lovelace', enabled: true });
    http.expectOne(`${url}/guardians`).flush([{ id: 'g-1', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org' }]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('STU-00000001');
    expect(text).toContain('Grace Hopper');
    http.verify();
  });
});
