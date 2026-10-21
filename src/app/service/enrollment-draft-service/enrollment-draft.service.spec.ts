import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ENROLLMENT_DRAFT_OWNER, ENROLLMENT_DRAFT_STORAGE, EnrollmentDraftService } from './enrollment-draft.service';

export function memoryDraftStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}

describe('EnrollmentDraftService', () => {
  let service: EnrollmentDraftService;
  let storage: Storage;
  let owner: string | null;
  beforeEach(() => {
    owner = 'operator-1'; storage = memoryDraftStorage();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), { provide: ENROLLMENT_DRAFT_STORAGE, useValue: storage }, { provide: ENROLLMENT_DRAFT_OWNER, useValue: () => owner }] });
    service = TestBed.inject(EnrollmentDraftService);
  });

  it('retrouve une saisie partielle depuis une nouvelle lecture persistante', () => {
    const draft = service.create('school', 'year');
    draft.identity.firstName = 'Ada';
    draft.guardian.email = 'parent@example.org';
    draft.selection.payments = [{ feeId: 'fee', amount: 50, method: 'CASH', reference: 'Acompte' }];
    expect(service.save(draft)).toBeTrue();
    const saved = service.list('school', 'year')[0];
    expect(saved.identity.firstName).toBe('Ada');
    expect(saved.guardian.email).toBe('parent@example.org');
    expect(saved.selection.payments[0].amount).toBe(50);
    expect(storage.length).toBe(1);
  });

  it('isole les comptes, établissements et années et refuse un brouillon d’un ancien compte', () => {
    const draft = service.create('school', 'year');
    expect(service.save(draft)).toBeTrue();
    expect(service.list('other-school', 'year')).toEqual([]);
    expect(service.list('school', 'other-year')).toEqual([]);
    owner = 'operator-2';
    expect(service.list('school', 'year')).toEqual([]);
    expect(service.save(draft)).toBeFalse();
    owner = 'operator-1';
    expect(service.list('school', 'year')).toHaveSize(1);
  });

  it('ne conserve aucun brouillon sans compte identifié', () => {
    owner = null;
    expect(service.save(service.create('school', 'year'))).toBeFalse();
    expect(storage.length).toBe(0);
  });

  it('ignore les données corrompues et les versements invalides', () => {
    const draft = service.create('school', 'year');
    service.save(draft);
    const key = storage.key(0)!;
    storage.setItem(key, '{corrompu');
    expect(service.list('school', 'year')).toEqual([]);
    storage.setItem(key, JSON.stringify([{ ...draft, step: 99 }, { ...draft, selection: { ...draft.selection, payments: [{ feeId: 'f', amount: -1, method: 'CASH', reference: '' }] } }]));
    expect(service.list('school', 'year')).toEqual([]);
  });

  it('signale un stockage indisponible sans annoncer une sauvegarde réussie', () => {
    spyOn(storage, 'setItem').and.throwError('Quota dépassé');
    expect(service.save(service.create('school', 'year'))).toBeFalse();
  });

  it('met à jour un même brouillon et retire seulement celui demandé', () => {
    const first = service.create('school', 'year');
    const second = service.create('school', 'year');
    service.save(first); service.save(second);
    first.step = 2; first.studentId = 'student'; service.save(first);
    expect(service.list('school', 'year')).toHaveSize(2);
    expect(service.remove('school', 'year', first.id)).toBeTrue();
    expect(service.list('school', 'year').map(draft => draft.id)).toEqual([second.id]);
  });

  it('conserve plusieurs tuteurs en cours tout en lisant les anciens brouillons', () => {
    const draft = service.create('school', 'year');
    draft.guardians = [{ firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org' }, { firstName: 'Marie', lastName: '', email: '' }];
    expect(service.save(draft)).toBeTrue();
    expect(service.list('school', 'year')[0].guardians).toEqual(draft.guardians);
    delete draft.guardians;
    expect(service.save(draft)).toBeTrue();
    expect(service.list('school', 'year')[0].guardians).toBeUndefined();
    draft.guardians = [{ firstName: 'A'.repeat(101), lastName: '', email: '' }];
    expect(service.save(draft)).toBeFalse();
  });
});
