import { ToastService } from '../../../service/toast-service/toast.service';
import { openFormModal } from '../../../testing/modal-fixture';
import { withPermissionChecks } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { EstablishmentSettingsComponent } from './establishment-settings.component';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';

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
      { provide: WorkspaceAccessService, useValue: withPermissionChecks({ canUpdateEstablishment: () => true, has: (permission: string) => ['can_establishment_read', 'can_establishment_update', 'can_academic_year_create', 'can_academic_year_read'].includes(permission), hasPermission: (permission: string) => ['can_establishment_read', 'can_establishment_update', 'can_academic_year_create', 'can_academic_year_read'].includes(permission) }) },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ establishmentId: 'school-1' }) } } }
    ]
  }));

  async function setupEdition() {
    const http = TestBed.inject(HttpTestingController);
    const context = TestBed.inject(WorkspaceContextService);
    const school = { id: 'school-1', code: 'S1', name: 'École', enabled: true, createdAt: '', updatedAt: '' };
    context.selectEstablishment(school);
    context.selectAcademicYear(year);
    const fixture = TestBed.createComponent(EstablishmentSettingsComponent);
    fixture.detectChanges();
    http.expectOne(`${api}/establishments`).flush([school]);
    http.expectOne(url).flush([year]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Modifier')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return { http, context, fixture, root, school };
  }

  it('modifie le nom seul et actualise le contexte sans perdre l’année', async () => {
    const { http, context, fixture, root, school } = await setupEdition();
    const input = root.querySelector<HTMLInputElement>('[name="establishmentName"]')!;
    expect(input.value).toBe('École');
    input.value = 'Nouvelle école';
    input.dispatchEvent(new Event('input'));
    const form = input.closest('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    const request = http.expectOne(`${api}/establishments/school-1`);
    expect(request.request.body).toEqual({ name: 'Nouvelle école' });
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectNone(`${api}/establishments/school-1`);
    request.flush({ ...school, name: 'Nouvelle école' });
    fixture.detectChanges();
    expect(context.current()?.establishmentName).toBe('Nouvelle école');
    expect(context.current()?.academicYearId).toBe(year.id);
    expect(TestBed.inject(ToastService).notifications().map(item => item.message)).toContain('Établissement modifié.');
    http.verify();
  });

  for (const status of [400, 403, 409, 500]) {
    it(`conserve la saisie après erreur ${status}`, async () => {
      const { http, fixture, root } = await setupEdition();
      const input = root.querySelector<HTMLInputElement>('[name="establishmentCode"]')!;
      input.value = 'CODE-2';
      input.dispatchEvent(new Event('input'));
      input.closest('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      http.expectOne(`${api}/establishments/school-1`).flush({}, { status, statusText: 'Erreur' });
      fixture.detectChanges();
      expect(input.value).toBe('CODE-2');
      expect(root.querySelector('[role="alert"]')).toBeTruthy();
      expect(root.querySelector('[name="establishmentCode"]')).toBeTruthy();
      http.verify();
    });
  }

  it('masque la modification sans autorisation', async () => {
    spyOn(TestBed.inject(WorkspaceAccessService), 'canUpdateEstablishment').and.returnValue(false);
    const { root, http } = await setupEdition();
    expect(root.querySelector('[name="establishmentCode"]')).toBeNull();
    expect(Array.from(root.querySelectorAll('button')).some((button) => button.textContent?.trim() === 'Modifier')).toBeFalse();
    http.verify();
  });

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
    openFormModal(fixture, 'Créer une année scolaire');
    expect((fixture.nativeElement as HTMLElement).querySelector('#year-name')).toBeTruthy();
    http.verify();
  });
});
