import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { GradeLevelManagerComponent } from './grade-level-manager.component';

describe('GradeLevelManagerComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/grade-levels`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [GradeLevelManagerComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
  }));

  it('affiche les niveaux avec leurs actions', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(GradeLevelManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.detectChanges();
    http.expectOne(url).flush([{ id: 'l-1', establishmentId: 'school-1', code: 'P1', name: 'Primary 1', displayOrder: 1, enabled: true }]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Primary 1');
    expect(text).toContain('Modifier');
    expect(text).toContain('Archiver');
    http.verify();
  });
});
