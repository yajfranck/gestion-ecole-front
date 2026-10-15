import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { AcademicYearFinanceComponent } from './academic-year-finance.component';

describe('AcademicYearFinanceComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1`;
  const year = { id: 'year-1', establishmentId: 'school-1', name: '2026-2027', startsOn: '2026-09-01', endsOn: '2027-06-30', enabled: true };

  beforeEach(() => TestBed.configureTestingModule({
    imports: [AcademicYearFinanceComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
  }));

  it('charge niveaux et élèves de l’établissement pour l’année sélectionnée', () => {
    const http = TestBed.inject(HttpTestingController);
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment({ id: 'school-1', code: 'S1', name: 'École', enabled: true, createdAt: '', updatedAt: '' });
    context.selectAcademicYear(year);

    const fixture = TestBed.createComponent(AcademicYearFinanceComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/grade-levels`).flush([]);
    http.expectOne(`${base}/students`).flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-tuition-workspace')).toBeTruthy();
    http.match(() => true).forEach((request) => request.flush([]));
  });

  it('signale une erreur de chargement', () => {
    const http = TestBed.inject(HttpTestingController);
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment({ id: 'school-1', code: 'S1', name: 'École', enabled: true, createdAt: '', updatedAt: '' });
    context.selectAcademicYear(year);

    const fixture = TestBed.createComponent(AcademicYearFinanceComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/grade-levels`).flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Impossible de charger l’espace financier');
    http.verify();
  });
});
