import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmployeeWorkspaceComponent } from './employee-workspace.component';

describe('EmployeeWorkspaceComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EmployeeWorkspaceComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])]
    });
  });

  it('keeps team navigation out of the page content', () => {
    const fixture = TestBed.createComponent(EmployeeWorkspaceComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Équipe et accès');
    expect(fixture.nativeElement.querySelector('nav[aria-label="Gestion de l’équipe"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});