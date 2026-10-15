import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { SubjectListComponent } from './subject-list.component';

describe('SubjectListComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/subjects`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [SubjectListComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
  }));

  function create() {
    const fixture = TestBed.createComponent(SubjectListComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.detectChanges();
    return fixture;
  }

  it('affiche les matières de l’établissement', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = create();
    http.expectOne(url).flush([{ id: 's-1', establishmentId: 'school-1', code: 'MATH', name: 'Mathematics', enabled: true }]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Mathematics');
    http.verify();
  });

  it('indique l’absence de matière', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = create();
    http.expectOne(url).flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucune matière');
    http.verify();
  });
});
