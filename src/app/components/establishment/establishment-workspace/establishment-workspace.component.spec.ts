import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { EstablishmentWorkspaceComponent } from './establishment-workspace.component';

describe('EstablishmentWorkspaceComponent', () => {
  const api = environment.apiUrl;
  const school = (id: string) => ({ id, code: id.toUpperCase(), name: `École ${id}`, enabled: true, createdAt: '', updatedAt: '' });
  const year = (establishmentId: string, id: string, startsOn: string, endsOn: string) => ({ id, establishmentId, name: id, startsOn, endsOn, enabled: true });
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ establishmentId: 'school-1' }));
    TestBed.configureTestingModule({
      imports: [EstablishmentWorkspaceComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } }
      ]
    });
  });

  it('fournit le contenu sans dupliquer la navigation du layout', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EstablishmentWorkspaceComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('router-outlet')).toBeNull();
    http.expectOne(`${api}/establishments`).flush([school('school-1')]);
    http.expectOne(`${api}/establishments/school-1/school-years`).flush([year('school-1', 'y1', '2000-01-01', '2000-12-31')]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('École school-1');
    expect(root.querySelector('app-establishment-nav')).toBeNull();
    expect(root.querySelector('router-outlet')).toBeTruthy();
    http.verify();
  });

  it('retire le contenu et le contexte précédent lors d’un changement d’établissement', () => {
    const http = TestBed.inject(HttpTestingController);
    const context = TestBed.inject(WorkspaceContextService);
    const fixture = TestBed.createComponent(EstablishmentWorkspaceComponent);
    fixture.detectChanges();
    http.expectOne(`${api}/establishments`).flush([school('school-1'), school('school-2')]);
    http.expectOne(`${api}/establishments/school-1/school-years`).flush([year('school-1', 'y1', '2000-01-01', '2000-12-31')]);
    context.selectAcademicYear(year('school-1', 'y1', '2000-01-01', '2000-12-31'));
    fixture.detectChanges();

    params.next(convertToParamMap({ establishmentId: 'school-2' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeNull();

    http.expectOne(`${api}/establishments`).flush([school('school-1'), school('school-2')]);
    http.expectOne(`${api}/establishments/school-2/school-years`).flush([]);
    fixture.detectChanges();

    expect(context.current()?.establishmentId).toBe('school-2');
    expect(context.current()?.academicYearId).toBeNull();
    expect(context.academicYears()).toEqual([]);
    http.verify();
  });

  it('conserve l’année déjà sélectionnée de l’établissement', () => {
    const http = TestBed.inject(HttpTestingController);
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment(school('school-1'));
    const chosen = year('school-1', 'y2', '2001-01-01', '2001-12-31');
    context.selectAcademicYear(chosen);

    const fixture = TestBed.createComponent(EstablishmentWorkspaceComponent);
    fixture.detectChanges();
    http.expectOne(`${api}/establishments`).flush([school('school-1')]);
    http.expectOne(`${api}/establishments/school-1/school-years`).flush([year('school-1', 'y1', '2000-01-01', '2000-12-31'), chosen]);

    expect(context.current()?.academicYearId).toBe('y2');
    http.verify();
  });

  it('signale un établissement inaccessible sans afficher de rubriques', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EstablishmentWorkspaceComponent);
    fixture.detectChanges();
    http.expectOne(`${api}/establishments`).flush([school('autre')]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('absent ou inaccessible');
    expect(fixture.nativeElement.querySelector('app-establishment-nav')).toBeNull();
    http.verify();
  });
});
