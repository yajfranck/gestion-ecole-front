import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { EstablishmentSettingsComponent } from './establishment-settings.component';

describe('EstablishmentSettingsComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/school-years`;
  const api = environment.apiUrl;
  const year = { id: 'year-1', establishmentId: 'school-1', name: '2026-2027', startsOn: '2026-09-01', endsOn: '2027-06-30', enabled: true };

  beforeEach(() => TestBed.configureTestingModule({
    imports: [EstablishmentSettingsComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ establishmentId: 'school-1' }) } } }
    ]
  }));

  it('liste les années, les publie dans le contexte et permet d’en sélectionner une', () => {
    const http = TestBed.inject(HttpTestingController);
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment({ id: 'school-1', code: 'S1', name: 'École', enabled: true, createdAt: '', updatedAt: '' });

    const fixture = TestBed.createComponent(EstablishmentSettingsComponent);
    fixture.detectChanges();
    http.expectOne(`${api}/establishments`).flush([{ id: 'school-1', code: 'S1', name: 'École', enabled: true, createdAt: '', updatedAt: '' }]);
    http.expectOne(url).flush([year]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('2026-2027');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('S1');
    expect(context.academicYears()).toEqual([year]);

    const select = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Sélectionner'));
    select?.click();
    expect(context.current()?.academicYearId).toBe('year-1');
    http.verify();
  });

  it('crée une année avec le formulaire d’ajout', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EstablishmentSettingsComponent);
    fixture.detectChanges();
    http.expectOne(`${api}/establishments`).flush([]);
    http.expectOne(url).flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucune année scolaire');
    expect((fixture.nativeElement as HTMLElement).querySelector('#year-name')).toBeTruthy();
    http.verify();
  });
});
