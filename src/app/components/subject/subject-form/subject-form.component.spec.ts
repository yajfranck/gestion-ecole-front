import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { SubjectFormComponent } from './subject-form.component';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';

const subject = {
  id: 'math',
  establishmentId: 'school',
  name: 'Mathématiques',
  code: 'MATH',
  enabled: true,
  createdAt: '',
  updatedAt: '',
};
describe('SubjectFormComponent', () => {
  const url = `${environment.apiUrl}/establishments/school/subjects`;
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [SubjectFormComponent],
      providers: [providePermissionFixture(['can_subject_create', 'can_subject_update'], ['school', 'school-1', 'other-school']),
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function create(editing = false) {
    const fixture = TestBed.createComponent(SubjectFormComponent);
    fixture.componentRef.setInput('establishmentId', 'school');
    if (editing) fixture.componentRef.setInput('subject', subject);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      http: TestBed.inject(HttpTestingController),
    };
  }
  it('crée une matière par son nom seul, nettoyé', () => {
    const { component, http } = create();
    component['rows'][0].name = '  Mathématiques  ';
    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);
    component['save']();
    const call = http.expectOne(url);
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual({ subjects: [{ name: 'Mathématiques' }] });
    call.flush([subject]);
    expect(saved).toHaveBeenCalledWith([subject]);
  });
  it('crée plusieurs matières en une seule requête atomique, dans l’ordre saisi', () => {
    const { component, http } = create();
    component['rows'][0].name = 'Français';
    component['add']();
    component['rows'][1].name = 'Mathématiques';
    component['save']();
    const call = http.expectOne(url);
    expect(call.request.body).toEqual({
      subjects: [{ name: 'Français' }, { name: 'Mathématiques' }],
    });
    http.expectNone(`${url}/batch`);
    call.flush([{ ...subject, id: 'french', name: 'Français' }, subject]);
  });
  it('autorise les homonymes et retire seulement la ligne choisie', () => {
    const { component, http } = create();
    component['rows'][0].name = 'Mathématiques';
    component['add']();
    component['rows'][1].name = 'À retirer';
    component['add']();
    component['rows'][2].name = 'Mathématiques';
    component['remove'](component['rows'][1].id);
    component['save']();
    const call = http.expectOne(url);
    expect(call.request.body.subjects).toEqual([
      { name: 'Mathématiques' },
      { name: 'Mathématiques' },
    ]);
    call.flush([subject, { ...subject, id: 'other' }]);
  });
  it('empêche d’enlever la dernière ligne et d’ajouter plus de 100 matières', () => {
    const { component } = create();
    component['remove'](component['rows'][0].id);
    expect(component['rows'].length).toBe(1);
    for (let i = 0; i < 101; i++) component['add']();
    expect(component['rows'].length).toBe(100);
  });
  for (const invalid of ['', '   ', 'x'.repeat(101)]) {
    it(`refuse un nom invalide de longueur ${invalid.length} avant tout envoi`, () => {
      const { component, http } = create();
      component['rows'][0].name = invalid;
      component['save']();
      http.expectNone(() => true);
      expect(component['error']()).toContain('1 à 100');
    });
  }
  it('refuse un lot entier si une seule ligne est vide', () => {
    const { component, http } = create();
    component['rows'][0].name = 'Valide';
    component['add']();
    component['save']();
    http.expectNone(() => true);
    expect(component['error']()).toContain('1 à 100');
  });

  it('accepte exactement 100 matières avec des noms de 100 caractères', () => {
    const { component, http } = create();
    for (let index = 1; index < 100; index++) component['add']();
    component['rows'].forEach((row) => (row.name = 'x'.repeat(100)));
    component['save']();
    const call = http.expectOne(url);
    expect(call.request.body.subjects.length).toBe(100);
    expect(
      call.request.body.subjects.every((item: { name: string }) => item.name.length === 100),
    ).toBeTrue();
    call.flush(Array.from({ length: 100 }, (_, index) => ({ ...subject, id: `subject-${index}` })));
  });
  it('renomme par PATCH avec le code existant et conserve l’identifiant', () => {
    const { component, http, fixture } = create(true);
    component['rows'][0].name = 'Mathématiques avancées';
    component['add']();
    expect(component['rows'].length).toBe(1);
    component['save']();
    const call = http.expectOne(`${url}/math`);
    expect(call.request.method).toBe('PATCH');
    expect(call.request.body).toEqual({ name: 'Mathématiques avancées', code: 'MATH' });
    call.flush({ ...subject, name: 'Mathématiques avancées' });
    expect(fixture.nativeElement.querySelector('button[aria-label]')).toBeNull();
  });
  it('conserve toutes les lignes après refus du lot et bloque les doubles envois', () => {
    const { component, http } = create();
    component['rows'][0].name = 'Mathématiques';
    component['add']();
    component['rows'][1].name = 'Français';
    const saved = jasmine.createSpy('saved');
    component.saved.subscribe(saved);
    component['save']();
    component['save']();
    component['add']();
    component['remove'](component['rows'][0].id);
    expect(component['rows'].length).toBe(2);
    http.expectOne(url).flush({}, { status: 409, statusText: 'Conflict' });
    expect(component['rows'].map((row) => row.name)).toEqual(['Mathématiques', 'Français']);
    expect(component['saving']()).toBeFalse();
    expect(component['error']()).toContain('saisie est conservée');
    expect(saved).not.toHaveBeenCalled();
  });
  it('refuse de modifier une matière d’un autre établissement', () => {
    const { component, fixture, http } = create(true);
    fixture.componentRef.setInput('subject', { ...subject, establishmentId: 'other' });
    fixture.detectChanges();
    component['save']();
    http.expectNone(() => true);
    expect(component['error']()).toContain('inaccessible');
  });

  it('normalise les codes renseignés et omet les codes laissés vides dans un même lot', () => {
    const { component, http } = create();
    Object.assign(component['rows'][0], { name: '  Mathématiques  ', code: ' math ' });
    component['add']();
    Object.assign(component['rows'][1], { name: ' Français ', code: '   ' });
    component['add']();
    component['rows'][2].name = 'Anglais';
    component['save']();
    const call = http.expectOne(url);
    expect(call.request.body).toEqual({ subjects: [
      { name: 'Mathématiques', code: 'MATH' }, { name: 'Français' }, { name: 'Anglais' }
    ] });
    call.flush([]);
  });

  it('refuse les codes dupliqués après normalisation avant tout appel', () => {
    const { component, http } = create();
    Object.assign(component['rows'][0], { name: 'Mathématiques', code: ' math ' });
    component['add']();
    Object.assign(component['rows'][1], { name: 'Autre matière', code: 'MATH' });
    component['save']();
    http.expectNone(() => true);
    expect(component['error']()).toContain('Matière 2');
    expect(component['error']()).toContain('MATH');
  });

  it('refuse les codes de plus de 40 caractères et accepte la limite', () => {
    const { component, http } = create();
    Object.assign(component['rows'][0], { name: 'Mathématiques', code: 'x'.repeat(41) });
    component['save']();
    http.expectNone(() => true);
    expect(component['error']()).toContain('40');
    component['rows'][0].code = 'x'.repeat(40);
    component['save']();
    const call = http.expectOne(url);
    expect(call.request.body.subjects[0].code).toBe('X'.repeat(40));
    call.flush([]);
  });

  it('conserve le lot après une erreur 400 et permet une correction puis un nouvel envoi', () => {
    const { component, http } = create();
    Object.assign(component['rows'][0], { name: 'Mathématiques', code: 'MATH' });
    component['add']();
    component['rows'][1].name = 'Français';
    component['save']();
    http.expectOne(url).flush({}, { status: 400, statusText: 'Bad Request' });
    expect(component['rows'].map(row => [row.name, row.code])).toEqual([['Mathématiques', 'MATH'], ['Français', '']]);
    expect(component['saving']()).toBeFalse();
    component['rows'][0].code = 'MATH2';
    component['save']();
    http.expectOne(url).flush([subject]);
  });

  it('refuse la création sans permission et autorise le formulaire de modification seul', () => {
    TestBed.overrideProvider(WorkspaceAccessService, { useValue: {
      hasPermission: (permission: string) => permission === 'can_subject_update',
      allows: (permission: string) => permission === 'can_subject_update'
    } });
    const { component, fixture, http } = create();
    component['rows'][0].name = 'Mathématiques';
    component['save']();
    http.expectNone(() => true);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    fixture.componentRef.setInput('subject', subject);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    component['save']();
    http.expectOne(`${url}/math`).flush(subject);
  });
});
