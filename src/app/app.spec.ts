import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { FEATURE_PERMISSIONS } from './core/feature-permissions';
import { TimetableWorkspaceComponent } from './components/timetable/timetable-workspace/timetable-workspace.component';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideRouter(routes)]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the login page', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/login');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Ravi de vous retrouver');
  });

  it('déclare la route annuelle de l’emploi du temps avec sa règle de permission', () => {
    const schoolYearChildren = routes
      .find(route => route.path === '')?.children
      ?.find(route => route.path === 'establishments/:establishmentId')?.children
      ?.find(route => route.path === 'school-years/:academicYearId')?.children ?? [];
    const timetableRoute = schoolYearChildren.find(route => route.path === 'timetable');

    expect(timetableRoute?.component).toBe(TimetableWorkspaceComponent);
    expect(timetableRoute?.data?.['permissionRule']).toEqual(FEATURE_PERMISSIONS.timetable);
  });
});
