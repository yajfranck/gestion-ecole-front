import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { WorkspaceAccessService } from '../../core/workspace-access.service';
import { WorkspaceContextService } from '../workspace-context.service';
import { AuthenticatedLayoutComponent } from './authenticated-layout.component';

describe('AuthenticatedLayoutComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [AuthenticatedLayoutComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: AuthService, useValue: { logout: jasmine.createSpy('logout') } },
      { provide: WorkspaceAccessService, useValue: { hasPermission: () => false } }
    ]
  }));

  it('affiche la configuration dans la sidebar sans déplacer les autres rubriques', () => {
    const workspaceContext = TestBed.inject(WorkspaceContextService);
    workspaceContext.current.set({
      establishmentId: 'school-1',
      establishmentName: 'École Exemple',
      academicYearId: 'year-1',
      academicYearName: '2025-2026'
    });
    workspaceContext.academicYears.set([{
      id: 'year-1',
      establishmentId: 'school-1',
      name: '2025-2026',
      startsOn: '2025-09-01',
      endsOn: '2026-06-30',
      enabled: true
    }]);

    const fixture = TestBed.createComponent(AuthenticatedLayoutComponent);
    fixture.detectChanges();
    const sidebar = fixture.nativeElement.querySelector('aside') as HTMLElement;

    expect(sidebar.textContent).toContain('École Exemple');
    expect(sidebar.textContent).toContain('2025-2026');
    expect(sidebar.querySelector<HTMLAnchorElement>('a[href="/establishments/school-1"]')?.textContent).toBe('Configuration');
    expect(sidebar.textContent).not.toContain('Personnel');
    expect(sidebar.textContent).not.toContain('Postes');
    expect(sidebar.textContent).not.toContain('Rôles');
    expect(sidebar.textContent).not.toContain('Permissions');
    expect(sidebar.textContent).not.toContain('Classes');
    expect(sidebar.textContent).not.toContain('Élèves');
    expect(sidebar.textContent).not.toContain('Inscriptions');
    expect(sidebar.textContent).not.toContain('Finances');
    const header = fixture.nativeElement.querySelector('header') as HTMLElement;
    expect(header.querySelectorAll('app-establishment-nav').length).toBe(1);
    expect(header.textContent).not.toContain('École Exemple');
    const headerWithoutNavigation = header.cloneNode(true) as HTMLElement;
    headerWithoutNavigation.querySelector('app-establishment-nav')?.remove();
    expect(headerWithoutNavigation.textContent).not.toContain('2025-2026');
    expect(header.querySelector('button[aria-label="Se déconnecter"]')).toBeTruthy();
  });

  it('masque la configuration sans établissement sélectionné', () => {
    const fixture = TestBed.createComponent(AuthenticatedLayoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('aside').textContent).not.toContain('Configuration');
    expect(fixture.nativeElement.querySelector('app-establishment-nav')).toBeNull();
  });

  it('actualise le lien de configuration lors du changement d’établissement', () => {
    const context = TestBed.inject(WorkspaceContextService);
    context.current.set({ establishmentId: 'school-1', establishmentName: 'École 1', academicYearId: null, academicYearName: null });
    const fixture = TestBed.createComponent(AuthenticatedLayoutComponent);
    fixture.detectChanges();

    context.current.set({ establishmentId: 'school-2', establishmentName: 'École 2', academicYearId: null, academicYearName: null });
    fixture.detectChanges();

    const sidebar = fixture.nativeElement.querySelector('aside') as HTMLElement;
    expect(sidebar.querySelector('a[href="/establishments/school-1"]')).toBeNull();
    expect(sidebar.querySelector<HTMLAnchorElement>('a[href="/establishments/school-2"]')?.textContent).toBe('Configuration');
  });
});
