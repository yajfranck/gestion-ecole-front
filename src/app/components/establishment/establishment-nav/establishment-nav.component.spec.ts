import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { EstablishmentNavComponent } from './establishment-nav.component';

describe('EstablishmentNavComponent', () => {
  const school = { id: 'school-1', code: 'S1', name: 'École', enabled: true, createdAt: '', updatedAt: '' };
  const year = (id: string) => ({ id, establishmentId: 'school-1', name: `Année ${id}`, startsOn: '2026-09-01', endsOn: '2027-06-30', enabled: true });

  beforeEach(() => TestBed.configureTestingModule({
    imports: [EstablishmentNavComponent],
    providers: [provideZonelessChangeDetection(), provideRouter([{ path: '**', children: [] }])]
  }));

  function create() {
    const fixture = TestBed.createComponent(EstablishmentNavComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.detectChanges();
    return fixture;
  }

  const labels = (root: HTMLElement) => Array.from(root.querySelectorAll('a')).map((link) => link.textContent?.trim());

  it('regroupe les rubriques d’établissement sans dépendre d’une année', () => {
    const fixture = create();
    const root = fixture.nativeElement as HTMLElement;

    expect(labels(root)).toEqual(['Configuration', 'Personnel', 'Postes', 'Rôles', 'Permissions', 'Élèves', 'Matières et niveaux']);
    expect(root.querySelectorAll('[role="group"]').length).toBe(4);
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
