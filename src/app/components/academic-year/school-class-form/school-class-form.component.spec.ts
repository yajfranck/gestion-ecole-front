import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { SchoolClassFormComponent } from './school-class-form.component';

describe('SchoolClassFormComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/school-years/year-1/classes`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [SchoolClassFormComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(),
      providePermissionFixture(['can_school_class_create'])]
  }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup(establishmentId = 'school-1') {
    const fixture = TestBed.createComponent(SchoolClassFormComponent);
    fixture.componentRef.setInput('establishmentId', establishmentId);
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();
    return fixture;
  }

  it('crée une classe sans salle et normalise ses champs', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const saved = jasmine.createSpy('saved');
    const busy = jasmine.createSpy('busy');
    component.saved.subscribe(saved);
    component.busyChange.subscribe(busy);
    component['rows'][0] = { id: 0, code: ' cp ', name: ' Cours préparatoire ', series: '   ' };
    (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = TestBed.inject(HttpTestingController).expectOne(url);
    expect(request.request.body).toEqual({ code: 'CP', name: 'Cours préparatoire', series: null });
    component['save'](); // Un double envoi est ignoré pendant la requête.
    expect(component['saving']()).toBeTrue();
    component['add']();
    expect(component['rows']).toHaveSize(1);
    request.flush({ id: 'class-1', name: 'Cours préparatoire' });
    expect(saved).toHaveBeenCalledWith([{ id: 'class-1', name: 'Cours préparatoire' }]);
    expect(busy.calls.allArgs()).toEqual([[true], [false]]);
  });

  it('envoie plusieurs classes dans une seule requête bulk avec leurs séries facultatives', () => {
    const component = setup().componentInstance;
    component['rows'][0] = { id: 0, code: '6a', name: 'Sixième A', series: ' Générale ' };
    component['add']();
    Object.assign(component['rows'][1], { code: '6b', name: 'Sixième B', series: 'Générale' });
    component['save']();
    const request = TestBed.inject(HttpTestingController).expectOne(`${url}/bulk`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ classes: [
      { code: '6A', name: 'Sixième A', series: 'Générale' },
      { code: '6B', name: 'Sixième B', series: 'Générale' }
    ] });
    request.flush([]);
  });

  it('refuse les doublons de codes après normalisation', () => {
    const component = setup().componentInstance;
    component['rows'] = [
      { id: 0, code: '6a', name: 'Sixième A', series: '' },
      { id: 1, code: ' 6A ', name: 'Sixième B', series: 'Autre série' }
    ];
    component['save']();
    expect(component['error']()).toContain('Classe 2');
    TestBed.inject(HttpTestingController).expectNone((request) => request.method === 'POST');
  });

  for (const invalid of [
    { code: ' ', name: 'Nom', series: '' },
    { code: 'A', name: ' ', series: '' },
    { code: 'A'.repeat(41), name: 'Nom', series: '' },
    { code: 'A', name: 'N'.repeat(101), series: '' },
    { code: 'A', name: 'Nom', series: 'S'.repeat(101) }
  ]) {
    it(`refuse une classe invalide (${JSON.stringify(invalid).slice(0, 80)})`, () => {
      const component = setup().componentInstance;
      component['rows'] = [{ id: 0, ...invalid }];
      component['save']();
      expect(component['error']()).toContain('Saisissez');
      TestBed.inject(HttpTestingController).expectNone((request) => request.method === 'POST');
    });
  }

  it('limite le lot à 100 classes et conserve au moins une ligne', () => {
    const component = setup().componentInstance;
    component['remove'](0);
    expect(component['rows']).toHaveSize(1);
    for (let index = 1; index <= 100; index++) component['add']();
    expect(component['rows']).toHaveSize(100);
    component['rows'].forEach((row, index) => Object.assign(row, { code: `C${index}`, name: `Classe ${index}` }));
    component['save']();
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne(`${url}/bulk`);
    expect(request.request.body.classes).toHaveSize(100);
    request.flush([]);
    component['rows'].push({ id: 101, code: 'C101', name: 'Classe 101', series: '' });
    component['save']();
    http.expectNone((request) => request.method === 'POST');
    component['remove'](101);
    expect(component['rows']).toHaveSize(100);
  });

  for (const status of [400, 409]) {
    it(`conserve le lot et affiche le détail de la classe refusée (${status})`, () => {
      const component = setup().componentInstance;
      component['rows'] = [
        { id: 0, code: '6A', name: 'Sixième A', series: '' },
        { id: 1, code: '6B', name: 'Sixième B', series: '' }
      ];
      const saved = jasmine.createSpy('saved');
      component.saved.subscribe(saved);
      component['save']();
      TestBed.inject(HttpTestingController).expectOne(`${url}/bulk`).flush(
        { detail: 'classes[1]: code déjà utilisé' }, { status, statusText: 'Refus' }
      );
      expect(component['saving']()).toBeFalse();
      expect(component['rows']).toHaveSize(2);
      expect(component['error']()).toContain('classes[1]');
      expect(component['error']()).toContain('Aucune classe n’a été créée');
      expect(saved).not.toHaveBeenCalled();
      component['rows'][1].code = '6C';
      component['save']();
      TestBed.inject(HttpTestingController).expectOne(`${url}/bulk`).flush([]);
      expect(saved).toHaveBeenCalled();
    });
  }

  it('refuse une création dans un établissement sans permission', () => {
    const component = setup('other-school').componentInstance;
    component['rows'][0] = { id: 0, code: '6A', name: 'Sixième A', series: '' };
    component['save']();
    TestBed.inject(HttpTestingController).expectNone((request) => request.method === 'POST');
  });
});
