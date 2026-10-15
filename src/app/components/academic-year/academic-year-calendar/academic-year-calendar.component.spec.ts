import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { AcademicYearCalendarComponent } from './academic-year-calendar.component';

describe('AcademicYearCalendarComponent', () => {
  const year = { id: 'year-1', establishmentId: 'school-1', name: '2026-2027', startsOn: '2026-09-01', endsOn: '2027-06-30', enabled: true };

  beforeEach(() => TestBed.configureTestingModule({
    imports: [AcademicYearCalendarComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
  }));

  it('affiche les paramètres et les périodes de l’année sélectionnée', () => {
    const http = TestBed.inject(HttpTestingController);
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment({ id: 'school-1', code: 'S1', name: 'École', enabled: true, createdAt: '', updatedAt: '' });
    context.selectAcademicYear(year);

    const fixture = TestBed.createComponent(AcademicYearCalendarComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/establishments/school-1/school-years/year-1/periods`).flush([]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Informations de l’année scolaire');
    expect(text).toContain('Périodes');
    http.verify();
  });

  it('ne rend rien sans année sélectionnée', () => {
    const fixture = TestBed.createComponent(AcademicYearCalendarComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });
});
