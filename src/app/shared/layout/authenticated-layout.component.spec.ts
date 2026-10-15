import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { WorkspaceContextService } from '../workspace-context.service';
import { AuthenticatedLayoutComponent } from './authenticated-layout.component';

describe('AuthenticatedLayoutComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [AuthenticatedLayoutComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: AuthService, useValue: { logout: jasmine.createSpy('logout') } }
    ]
  }));

  it('keeps establishment menus out of the sidebar', () => {
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
    expect(sidebar.textContent).not.toContain('Personnel');
    expect(sidebar.textContent).not.toContain('Postes');
    expect(sidebar.textContent).not.toContain('Rôles');
    expect(sidebar.textContent).not.toContain('Permissions');
    expect(sidebar.textContent).not.toContain('Classes');
    expect(sidebar.textContent).not.toContain('Élèves');
    expect(sidebar.textContent).not.toContain('Inscriptions');
    expect(sidebar.textContent).not.toContain('Finances');
  });
});
