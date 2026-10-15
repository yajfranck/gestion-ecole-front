import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { WorkspaceContextService } from '../../shared/workspace-context.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('opens an active establishment directly and does not link a disabled one', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/establishments`).flush([
      { id: 'school-1', code: 'NORTH', name: 'École du Nord', enabled: true, createdAt: '', updatedAt: '' },
      { id: 'school-2', code: 'SOUTH', name: 'École du Sud', enabled: false, createdAt: '', updatedAt: '' }
    ]);
    const currentYear = new Date().getFullYear();
    http.expectOne(`${environment.apiUrl}/establishments/school-1/school-years`).flush([
      {
        id: 'year-current',
        establishmentId: 'school-1',
        name: `${currentYear}-${currentYear + 1}`,
        startsOn: `${currentYear}-01-01`,
        endsOn: `${currentYear}-12-31`,
        enabled: true
      }
    ]);
    fixture.detectChanges();

    const activeLink = fixture.nativeElement.querySelector('a[href="/establishments/school-1"]');
    const disabledLink = fixture.nativeElement.querySelector('a[href="/establishments/school-2"]');
    expect(activeLink?.textContent).toContain('Ouvrir');
    expect(disabledLink).toBeNull();
    expect(TestBed.inject(WorkspaceContextService).current()?.academicYearName).toBe(`${currentYear}-${currentYear + 1}`);
  });
});
