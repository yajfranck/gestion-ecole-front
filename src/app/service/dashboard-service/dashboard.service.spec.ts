import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DashboardService } from './dashboard.service';
import { environment } from '../../../environments/environment';

describe('DashboardService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('consulte les agrégats sans identifiant d’établissement et applique les seuls filtres autorisés', () => {
    const api = TestBed.inject(DashboardService);
    const http = TestBed.inject(HttpTestingController);
    api.get().subscribe();
    const initial = http.expectOne(`${environment.apiUrl}/dashboard`);
    expect(initial.request.method).toBe('GET');
    expect(initial.request.params.keys()).toEqual([]);
    initial.flush({});
    api.get({ academicYearId: 'year', date: '2026-10-17' }).subscribe();
    const filtered = http.expectOne(`${environment.apiUrl}/dashboard?academicYearId=year&date=2026-10-17`);
    expect(filtered.request.params.has('establishmentId')).toBeFalse();
    filtered.flush({});
  });
});
