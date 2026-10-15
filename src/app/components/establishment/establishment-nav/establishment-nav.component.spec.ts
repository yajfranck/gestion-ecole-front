import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { EstablishmentNavComponent } from './establishment-nav.component';

describe('EstablishmentNavComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [EstablishmentNavComponent],
    providers: [provideZonelessChangeDetection(), provideRouter([])]
  }));

  it('affiche les menus de l’établissement et les années scolaires', () => {
    TestBed.inject(WorkspaceContextService).academicYears.set([{
      id: 'year-1',
      establishmentId: 'school-1',
      name: '2025-2026',
      startsOn: '2025-09-01',
      endsOn: '2026-06-30',
      enabled: true
    }]);

    const fixture = TestBed.createComponent(EstablishmentNavComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent;

    for (const label of ['Configuration', 'Personnel', 'Postes', 'Rôles', 'Permissions', '2025-2026']) {
      expect(text).toContain(label);
    }
  });
});
