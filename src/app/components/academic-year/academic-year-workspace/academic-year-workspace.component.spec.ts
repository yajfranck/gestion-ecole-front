import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AcademicYearWorkspaceComponent } from './academic-year-workspace.component';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';

describe('AcademicYearWorkspaceComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [AcademicYearWorkspaceComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([])
    ]
  }));

  it('keeps the academic year workspace separate from establishment setup', () => {
    const fixture = TestBed.createComponent(AcademicYearWorkspaceComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Configuration académique');
    expect(fixture.nativeElement.textContent).toContain('Année scolaire');
  });

  it('switches workspace sections from the page navigation', () => {
    const fixture = TestBed.createComponent(AcademicYearWorkspaceComponent);
    fixture.detectChanges();
    const navigation = fixture.nativeElement.querySelector('[aria-label="Rubriques de l’année scolaire"]') as HTMLElement;

    expect(navigation.querySelectorAll('button').length).toBe(6);
    (navigation.querySelectorAll('button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fiches élèves');
    expect(fixture.nativeElement.textContent).not.toContain('Niveaux et classes');
  });
});
