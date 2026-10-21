import { withPermissionChecks } from '../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withRouterConfig } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../environments/environment';
import { AcademicYearWorkspaceComponent } from '../components/academic-year/academic-year-workspace/academic-year-workspace.component';
import { EstablishmentWorkspaceComponent } from '../components/establishment/establishment-workspace/establishment-workspace.component';
import { AuthService } from '../core/auth.service';
import { LicenseAccessService } from '../core/license-access.service';
import { WorkspaceAccessService } from '../core/workspace-access.service';
import { AuthenticatedLayoutComponent } from './layout/authenticated-layout.component';
import { WorkspaceContextService } from './workspace-context.service';

@Component({ selector: 'app-menu-content', template: '<p>Contenu du menu</p>' })
class MenuContentComponent {}

describe('Navigation et sélection de l’année scolaire', () => {
  const api = environment.apiUrl;
  const school = (id: string) => ({ id, code: id, name: `École ${id}`, enabled: true, createdAt: '', updatedAt: '' });
  const year = (id: string, establishmentId = 'school-1') => ({
    id, establishmentId, name: `Année ${id}`, startsOn: '2000-01-01', endsOn: '2000-12-31', enabled: true
  });
  let http: HttpTestingController;
  let context: WorkspaceContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(),
        provideRouter([{
          path: '', component: AuthenticatedLayoutComponent, children: [{
            path: 'establishments/:establishmentId', component: EstablishmentWorkspaceComponent,
            children: [
              { path: 'students', component: MenuContentComponent },
              { path: 'team/employees', component: MenuContentComponent },
              { path: 'school-years/:academicYearId', component: AcademicYearWorkspaceComponent, children: [
                { path: 'classes', component: MenuContentComponent },
                { path: 'finance', component: MenuContentComponent }
              ] }
            ]
          }]
        }], withRouterConfig({ paramsInheritanceStrategy: 'always' })),
        { provide: AuthService, useValue: { logout: () => {} } },
        { provide: WorkspaceAccessService, useValue: withPermissionChecks({ has: (permission: string) => ['can_establishment_read', 'can_dashboard_read', 'can_employee_read_self', 'can_guardian_read_children'].includes(permission), hasPermission: (permission: string) => ['can_establishment_read', 'can_school_class_read', 'can_enrollment_read', 'can_tuition_read', 'can_academic_year_read'].includes(permission) }) },
        { provide: LicenseAccessService, useValue: { canRead: () => false, canUse: () => false, notice: () => null } }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    context = TestBed.inject(WorkspaceContextService);
    context.clear();
  });

  afterEach(() => { http.verify(); context.clear(); });

  async function load(harness: RouterTestingHarness, establishmentId = 'school-1') {
    http.expectOne(`${api}/establishments`).flush([school('school-1'), school('school-2')]);
    http.expectOne(`${api}/establishments/${establishmentId}/school-years`)
      .flush([year('past', establishmentId), year('other', establishmentId)]);
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function expectSelection(harness: RouterTestingHarness, selectedId: string) {
    const root = harness.routeNativeElement!;
    expect(context.current()?.academicYearId).toBe(selectedId);
    expect(root.querySelector('aside')?.textContent).toContain(`Année ${selectedId}`);
    expect(root.querySelector<HTMLSelectElement>('#nav-academic-year')?.value).toBe(selectedId);
    expect(root.querySelector(`a[href$="/school-years/${selectedId}/classes"]`)).toBeTruthy();
  }

  it('conserve le choix de la sidebar entre menus annuels et menus d’établissement sans nouvel appel API', async () => {
    const harness = await RouterTestingHarness.create('/establishments/school-1/students');
    await load(harness);
    const select = harness.routeNativeElement!.querySelector<HTMLSelectElement>('#nav-academic-year')!;
    select.value = 'past';
    select.dispatchEvent(new Event('change'));
    harness.detectChanges();
    expectSelection(harness, 'past');

    for (const path of ['school-years/past/classes', 'school-years/past/finance', 'team/employees', 'students']) {
      await harness.navigateByUrl(`/establishments/school-1/${path}`);
      harness.detectChanges();
      expectSelection(harness, 'past');
      http.expectNone((request) => request.url.startsWith(api));
    }
  });

  it('synchronise un accès direct après rafraîchissement avec l’année valide de l’URL', async () => {
    const harness = await RouterTestingHarness.create('/establishments/school-1/school-years/other/classes');
    await load(harness);
    expectSelection(harness, 'other');
    http.expectNone(`${api}/establishments/school-1/school-years/other`);
    await harness.navigateByUrl('/establishments/school-1/students');
    expectSelection(harness, 'other');
  });

  it('ne conserve aucune année d’un autre établissement sans validation de sa liste', async () => {
    const harness = await RouterTestingHarness.create('/establishments/school-1/school-years/past/classes');
    await load(harness);
    expectSelection(harness, 'past');
    await harness.navigateByUrl('/establishments/school-2/students');
    http.expectOne(`${api}/establishments`).flush([school('school-1'), school('school-2')]);
    expect(context.academicYear()).toBeNull();
    http.expectOne(`${api}/establishments/school-2/school-years`).flush([year('south', 'school-2')]);
    harness.detectChanges();
    expect(context.current()?.establishmentId).toBe('school-2');
    expect(context.academicYear()).toBeNull();
    expect(harness.routeNativeElement!.querySelector('aside')?.textContent).not.toContain('Année past');
  });

  it('refuse une année absente de la liste autorisée même si elle est présente dans l’URL', async () => {
    const harness = await RouterTestingHarness.create('/establishments/school-1/school-years/deleted/classes');
    await load(harness);
    expect(context.academicYear()).toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('absente ou inaccessible');
    expect(harness.routeNativeElement!.querySelector('app-academic-year-workspace app-menu-content')).toBeNull();
  });
});
