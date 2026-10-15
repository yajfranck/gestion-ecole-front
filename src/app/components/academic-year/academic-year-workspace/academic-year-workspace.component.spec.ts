import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { AcademicYearWorkspaceComponent } from './academic-year-workspace.component';

describe('AcademicYearWorkspaceComponent', () => {
  const url = (id: string) => `${environment.apiUrl}/establishments/school-1/school-years/${id}`;
  const year = (id: string) => ({ id, establishmentId: 'school-1', name: `Année ${id}`, startsOn: '2026-09-01', endsOn: '2027-06-30', enabled: true });
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ establishmentId: 'school-1', academicYearId: 'year-1' }));
    TestBed.configureTestingModule({
      imports: [AcademicYearWorkspaceComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } }
      ]
    });
    TestBed.inject(WorkspaceContextService).selectEstablishment({ id: 'school-1', code: 'S1', name: 'École', enabled: true, createdAt: '', updatedAt: '' });
  });

  it('valide l’année avant d’afficher ses rubriques et sans onglets propres', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AcademicYearWorkspaceComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('router-outlet')).toBeNull();
    http.expectOne(url('year-1')).flush(year('year-1'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Année year-1');
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
    expect(TestBed.inject(WorkspaceContextService).current()?.academicYearId).toBe('year-1');
    http.verify();
  });

  it('retire le contenu et le contexte de l’année précédente lors d’un changement d’année', () => {
    const http = TestBed.inject(HttpTestingController);
    const context = TestBed.inject(WorkspaceContextService);
    const fixture = TestBed.createComponent(AcademicYearWorkspaceComponent);
    fixture.detectChanges();
    http.expectOne(url('year-1')).flush(year('year-1'));
    fixture.detectChanges();

    params.next(convertToParamMap({ establishmentId: 'school-1', academicYearId: 'year-2' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeNull();
    expect(context.current()?.academicYearId).toBeNull();

    http.expectOne(url('year-2')).flush(year('year-2'));
    fixture.detectChanges();
    expect(context.current()?.academicYearId).toBe('year-2');
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
    http.verify();
  });

  it('n’affiche aucune rubrique pour une année invalide', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AcademicYearWorkspaceComponent);
    fixture.detectChanges();
    http.expectOne(url('year-1')).flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('absente ou inaccessible');
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeNull();
    http.verify();
  });
});
