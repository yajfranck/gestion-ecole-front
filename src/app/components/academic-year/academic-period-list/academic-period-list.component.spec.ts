import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { AcademicPeriodListComponent } from './academic-period-list.component';

describe('AcademicPeriodListComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/school-years/year-1/periods`;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AcademicPeriodListComponent],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });

  function create() {
    const fixture = TestBed.createComponent(AcademicPeriodListComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();
    return fixture;
  }

  it('affiche les périodes de l’année', () => {
    const fixture = create();
    http.expectOne(url).flush([{ id: 'p-1', academicYearId: 'year-1', name: 'Période 1', startsOn: '2026-09-01', endsOn: '2026-12-20' }]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Période 1');
    http.verify();
  });

  it('indique l’absence de période', () => {
    const fixture = create();
    http.expectOne(url).flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucune période configurée');
    http.verify();
  });
});
