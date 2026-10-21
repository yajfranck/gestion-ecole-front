import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { TimetableDaysFormComponent } from './timetable-days-form.component';
import { timetableYear } from '../testing/timetable.fixtures';

describe('TimetableDaysFormComponent', () => {
  const url = `${environment.apiUrl}/establishments/school/school-years/year/timetable/non-working-days`;
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [TimetableDaysFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function create() {
    const fixture = TestBed.createComponent(TimetableDaysFormComponent);
    fixture.componentRef.setInput('year', timetableYear);
    fixture.componentRef.setInput('allowed', true);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      http: TestBed.inject(HttpTestingController),
    };
  }
  it('remplace le calendrier de toute l’année et peut retirer tous les jours', () => {
    const { component, http } = create();
    http.expectOne(url).flush([{ date: '2026-12-25', name: 'Férié' }]);
    component['remove'](0);
    component['save']();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ days: [] });
    request.flush([]);
  });
  it('refuse les doublons et les dates hors année avant la requête', () => {
    const { component, http } = create();
    http.expectOne(url).flush([]);
    component['days'] = [
      { date: '2026-12-25', name: 'Férié' },
      { date: '2026-12-25', name: 'Vacances' },
    ];
    component['save']();
    http.expectNone(url);
    expect(component['error']()).toContain('unique');
    component['days'] = [{ date: '2027-09-01', name: 'Hors année' }];
    component['save']();
    http.expectNone(url);
  });
  it('ne remplace jamais un calendrier non chargé après une erreur de lecture', () => {
    const { component, http } = create();
    http.expectOne(url).flush({}, { status: 403, statusText: 'Forbidden' });
    component['save']();
    http.expectNone(url);
    expect(component['loaded']()).toBeFalse();
  });
  it('conserve les jours modifiés après un refus d’enregistrement', () => {
    const { component, http } = create();
    http.expectOne(url).flush([]);
    component['days'] = [{ date: '2026-12-25', name: '  Férié  ' }];
    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);
    component['save']();
    const request = http.expectOne(url);
    expect(request.request.body.days[0].name).toBe('Férié');
    request.flush({}, { status: 400, statusText: 'Bad Request' });
    expect(component['days'][0].name).toBe('  Férié  ');
    expect(component['saving']()).toBeFalse();
    expect(saved).not.toHaveBeenCalled();
  });
});
