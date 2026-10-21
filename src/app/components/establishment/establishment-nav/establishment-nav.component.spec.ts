import { withPermissionChecks } from '../../../testing/permission-fixture';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { EstablishmentNavComponent } from './establishment-nav.component';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { LicenseAccessService } from '../../../core/license-access.service';

describe('EstablishmentNavComponent', () => {
  const school = { id: 'school-1', code: 'S1', name: 'École', enabled: true, createdAt: '', updatedAt: '' };
  const year = (id: string) => ({ id, establishmentId: 'school-1', name: `Année ${id}`, startsOn: '2026-09-01', endsOn: '2027-06-30', enabled: true });

  beforeEach(() => TestBed.configureTestingModule({
    imports: [EstablishmentNavComponent],
    providers: [provideZonelessChangeDetection(), provideRouter([{ path: '**', children: [] }]),
      { provide: LicenseAccessService, useValue: { canUse: () => false } },
      { provide: WorkspaceAccessService, useValue: withPermissionChecks({ hasPermission: (permission: string) => ['can_employee_read', 'can_position_read', 'can_role_read', 'can_permission_read', 'can_student_read', 'can_subject_read', 'can_school_class_read', 'can_enrollment_read', 'can_academic_period_read', 'can_tuition_read', 'can_academic_year_read'].includes(permission) }) }]
  }));

  function create() {
    const fixture = TestBed.createComponent(EstablishmentNavComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.detectChanges();
    return fixture;
  }

  const labels = (root: HTMLElement) => Array.from(root.querySelectorAll('a')).map((link) => link.textContent?.trim());

  const trigger = (root: HTMLElement, label: string) => Array.from(root.querySelectorAll<HTMLButtonElement>('.group-trigger'))
    .find((button) => button.textContent?.trim() === label)!;

  it('ouvre un seul groupe à la fois et le ferme au clic extérieur', () => {
    const fixture = create();
    const root = fixture.nativeElement as HTMLElement;
    trigger(root, 'Administration').click();
    fixture.detectChanges();
    expect(trigger(root, 'Administration').getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector<HTMLElement>('#context-panel-0')?.hidden).toBeFalse();

    trigger(root, 'Référentiels et dossiers').click();
    fixture.detectChanges();
    expect(trigger(root, 'Administration').getAttribute('aria-expanded')).toBe('false');
    expect(trigger(root, 'Référentiels et dossiers').getAttribute('aria-expanded')).toBe('true');

    document.body.click();
    fixture.detectChanges();
    expect(root.querySelector('.group-trigger[aria-expanded="true"]')).toBeNull();
  });

  it('ferme le menu compact après sélection d’une destination', async () => {
    const fixture = create();
    const root = fixture.nativeElement as HTMLElement;
    const compact = root.querySelector<HTMLButtonElement>('.compact-trigger')!;
    compact.click();
    trigger(root, 'Administration').click();
    fixture.detectChanges();
    root.querySelector<HTMLAnchorElement>('a[href$="/team/employees"]')!.click();
    await fixture.whenStable();
    expect(compact.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('.group-trigger[aria-expanded="true"]')).toBeNull();
  });

  it('ouvre au clavier, parcourt les liens et rend le focus avec Échap', async () => {
    const fixture = create();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.compact-trigger')!.click();
    fixture.detectChanges();
    const button = trigger(root, 'Administration');
    button.focus();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await fixture.whenStable();
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('#context-panel-0 a'));
    expect(document.activeElement).toBe(links[0]);
    links[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(links[3]);
    links[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(links[0]);
    links[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('ferme la navigation quand le focus en sort', () => {
    const fixture = create();
    const root = fixture.nativeElement as HTMLElement;
    trigger(root, 'Administration').click();
    fixture.detectChanges();
    document.body.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
    expect(root.querySelector('.group-trigger[aria-expanded="true"]')).toBeNull();
  });

  it('met en évidence le groupe et la rubrique après une ouverture directe par URL', async () => {
    await TestBed.inject(Router).navigateByUrl('/establishments/school-1/team/roles');
    const fixture = create();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(trigger(root, 'Administration').classList.contains('is-active')).toBeTrue();
    expect(trigger(root, 'Référentiels et dossiers').classList.contains('is-active')).toBeFalse();
    expect(root.querySelector('a[href$="/team/roles"]')?.getAttribute('aria-current')).toBe('page');
  });

  it('ne propose pas les présences sans permission et reste sans liens annuels hors contexte', () => {
    const fixture = create();
    expect(labels(fixture.nativeElement)).not.toContain('Présences et absences');
    expect(labels(fixture.nativeElement)).not.toContain('Classes');
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment(school);
    context.selectAcademicYear(year('year-1'));
    fixture.detectChanges();
    expect(labels(fixture.nativeElement)).toContain('Classes');
    expect(labels(fixture.nativeElement)).not.toContain('Présences et absences');
    context.selectEstablishment({ ...school, id: 'school-2' });
    fixture.detectChanges();
    expect(labels(fixture.nativeElement)).not.toContain('Classes');
  });

  it('ajoute une seule rubrique présences avec la permission de lecture', () => {
    spyOn(TestBed.inject(WorkspaceAccessService), 'hasPermission').and.returnValue(true);
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment(school);
    context.setAcademicYears([year('year-1')]);
    context.selectAcademicYear(year('year-1'));
    const fixture = create();
    expect(labels(fixture.nativeElement).filter((label) => label === 'Présences et absences').length).toBe(1);
  });

  it('préserve le contexte et rétablit le sélecteur après annulation de navigation', async () => {
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment(school);
    context.setAcademicYears([year('year-1'), year('year-2')]);
    context.selectAcademicYear(year('year-1'));
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/establishments/school-1/school-years/year-1/attendance');
    spyOn(router, 'navigate').and.resolveTo(false);
    const fixture = create();
    const select = fixture.nativeElement.querySelector('#nav-academic-year') as HTMLSelectElement;
    select.value = 'year-2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(context.current()?.academicYearId).toBe('year-1');
    expect(select.value).toBe('year-1');
  });

  it('regroupe les rubriques d’établissement sans dépendre d’une année', () => {
    const fixture = create();
    const root = fixture.nativeElement as HTMLElement;

    expect(labels(root)).toEqual(['Personnel', 'Postes', 'Rôles', 'Permissions', 'Élèves', 'Matières']);
    expect(root.querySelectorAll('[role="group"]').length).toBe(3);
  });

  it('n’affiche les rubriques annuelles qu’avec une année valide de l’établissement', () => {
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment(school);
    context.setAcademicYears([year('year-1'), year('year-2')]);
    const fixture = create();
    expect(labels(fixture.nativeElement)).not.toContain('Classes');

    context.selectAcademicYear(year('year-1'));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(labels(root).slice(-4)).toEqual(['Classes', 'Inscriptions', 'Calendrier', 'Finances']);
    expect((root.querySelector('#nav-academic-year') as HTMLSelectElement).value).toBe('year-1');
    expect(root.querySelector<HTMLAnchorElement>('a[href$="/school-years/year-1/classes"]')).toBeTruthy();
  });

  it('change le contexte sans naviguer depuis une page d’établissement', async () => {
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment(school);
    context.setAcademicYears([year('year-1'), year('year-2')]);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/establishments/school-1/students');
    const fixture = create();

    const select = fixture.nativeElement.querySelector('#nav-academic-year') as HTMLSelectElement;
    select.value = 'year-2';
    select.dispatchEvent(new Event('change'));

    expect(context.current()?.academicYearId).toBe('year-2');
    expect(router.url).toBe('/establishments/school-1/students');
  });

  it('conserve la rubrique annuelle active lors d’un changement d’année', async () => {
    const context = TestBed.inject(WorkspaceContextService);
    context.selectEstablishment(school);
    context.setAcademicYears([year('year-1'), year('year-2')]);
    context.selectAcademicYear(year('year-1'));
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/establishments/school-1/school-years/year-1/finance');
    const fixture = create();

    const select = fixture.nativeElement.querySelector('#nav-academic-year') as HTMLSelectElement;
    select.value = 'year-2';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(router.url).toBe('/establishments/school-1/school-years/year-2/finance');
  });
});
