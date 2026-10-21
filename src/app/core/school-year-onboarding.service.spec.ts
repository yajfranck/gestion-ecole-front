import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { SchoolYearOnboardingService } from './school-year-onboarding.service';
import { AcademicYearService } from '../service/academic-year-service/academic-year.service';
import { AcademicYear } from '../models/academic-year/academic-year.model';
import { EstablishmentService } from '../service/establishment-service/establishment.service';
import { Establishment } from '../models/establishment/establishment.model';
import { WorkspaceContextService } from '../shared/workspace-context.service';

const school: Establishment = {
  id: 'school',
  code: 'ECOLE-001',
  name: 'École Les Acacias',
  enabled: true,
  createdAt: '',
  updatedAt: '',
};
const otherSchool = { ...school, id: 'other-school', code: 'ECOLE-002', name: 'École Les Lilas' };
const year = {
  id: 'year',
  establishmentId: 'school',
  name: '2026-2027',
  startsOn: '2026-09-01',
  endsOn: '2027-06-30',
  enabled: true,
};
const token = (roles = ['can_establishment_read', 'can_academic_year_create', 'can_academic_year_read'], suffix = '') =>
  `header.${btoa(JSON.stringify({ authorities: roles }))}.signature${suffix}`;

describe('SchoolYearOnboardingService', () => {
  const auth = { session: signal({ accessToken: token() }) };
  const years = jasmine.createSpyObj('AcademicYearService', ['getAcademicYears']);
  const establishments = jasmine.createSpyObj('EstablishmentService', ['getAccessible']);
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 18, 12));
    establishments.getAccessible.calls.reset();
    establishments.getAccessible.and.returnValue(of([school]));
    auth.session.set({ accessToken: token() });
    years.getAcademicYears.calls.reset();
    years.getAcademicYears.and.returnValue(of([]));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: auth },
        { provide: AcademicYearService, useValue: years },
        { provide: EstablishmentService, useValue: establishments },
      ],
    });
  });
  afterEach(() => jasmine.clock().uninstall());

  it('demande la première année et mémorise le résultat dans la session', () => {
    const service = TestBed.inject(SchoolYearOnboardingService);
    service.ensure().subscribe();
    service.ensure().subscribe();
    expect(establishments.getAccessible).toHaveBeenCalledTimes(1);
    expect(years.getAcademicYears).toHaveBeenCalledOnceWith('school');
    expect(service.status()).toBe('required');
    expect(service.complete(year)).toBeTrue();
    expect(service.status()).toBe('ready');
    expect(TestBed.inject(WorkspaceContextService).current()?.academicYearId).toBe('year');
    expect(TestBed.inject(WorkspaceContextService).current()?.establishmentName).toBe(school.name);
  });
  it('vérifie les deux établissements et reste en configuration après la première création', () => {
    establishments.getAccessible.and.returnValue(of([school, otherSchool]));
    const service = TestBed.inject(SchoolYearOnboardingService);
    service.ensure().subscribe();
    expect(years.getAcademicYears.calls.allArgs()).toEqual([['school'], ['other-school']]);
    expect(service.pendingEstablishments()).toEqual([school, otherSchool]);
    expect(service.complete(year)).toBeTrue();
    expect(service.status()).toBe('required');
    expect(service.establishment()).toEqual(otherSchool);
    expect(service.pendingEstablishments()).toEqual([otherSchool]);
    expect(
      service.complete({ ...year, id: 'second-year', establishmentId: otherSchool.id }),
    ).toBeTrue();
    expect(service.status()).toBe('ready');
    expect(service.pendingEstablishments()).toEqual([]);
    expect(TestBed.inject(WorkspaceContextService).current()?.establishmentId).toBe(otherSchool.id);
  });
  it('ne demande que les établissements sans année courante, quel que soit le contexte sélectionné', () => {
    establishments.getAccessible.and.returnValue(of([school, otherSchool]));
    years.getAcademicYears.and.callFake((id: string) => of(id === school.id ? [year] : []));
    TestBed.inject(WorkspaceContextService).selectEstablishment(school);
    const service = TestBed.inject(SchoolYearOnboardingService);
    service.ensure().subscribe();
    expect(service.pendingEstablishments()).toEqual([otherSchool]);
    expect(service.establishmentId()).toBe(otherSchool.id);
    expect(service.complete(year)).toBeFalse();
  });
  it('ne considère le parcours terminé que si tous les établissements ont une année courante', () => {
    establishments.getAccessible.and.returnValue(of([school, otherSchool]));
    years.getAcademicYears.and.callFake((id: string) => of([{ ...year, establishmentId: id }]));
    const service = TestBed.inject(SchoolYearOnboardingService);
    service.ensure().subscribe();
    expect(service.status()).toBe('ready');
    expect(service.pendingEstablishments()).toEqual([]);
  });
  it('ignore les établissements désactivés et ne vérifie les doublons qu’une fois', () => {
    establishments.getAccessible.and.returnValue(
      of([school, school, { ...otherSchool, enabled: false }]),
    );
    const service = TestBed.inject(SchoolYearOnboardingService);
    service.ensure().subscribe();
    expect(years.getAcademicYears).toHaveBeenCalledOnceWith('school');
    expect(service.managedEstablishments()).toEqual([school]);
  });
  it('ne propose aucun formulaire sans établissement actif accessible', () => {
    establishments.getAccessible.and.returnValue(of([]));
    const service = TestBed.inject(SchoolYearOnboardingService);
    service.ensure().subscribe();
    expect(service.status()).toBe('error');
    expect(service.pendingEstablishments()).toEqual([]);
    expect(years.getAcademicYears).not.toHaveBeenCalled();
  });
  it('ne traite pas un refus de la deuxième école comme une configuration terminée', () => {
    establishments.getAccessible.and.returnValue(of([school, otherSchool]));
    years.getAcademicYears.and.callFake((id: string) =>
      id === school.id ? of([year]) : throwError(() => new HttpErrorResponse({ status: 403 })),
    );
    const service = TestBed.inject(SchoolYearOnboardingService);
    service.ensure().subscribe();
    expect(service.status()).toBe('error');
    expect(service.error()).toContain(otherSchool.name);
    expect(service.error()).toContain('licence');
    expect(service.establishmentId()).toBe(otherSchool.id);
    expect(service.pendingEstablishments()).toEqual([]);
    years.getAcademicYears.and.callFake((id: string) => of([{ ...year, establishmentId: id }]));
    service.ensure(true).subscribe();
    expect(service.status()).toBe('ready');
    expect(service.error()).toBeNull();
  });
  for (const invalid of [
    { ...year, startsOn: '2025-09-01', endsOn: '2026-06-30' },
    { ...year, startsOn: '2027-09-01', endsOn: '2028-06-30' },
    { ...year, enabled: false },
    { ...year, establishmentId: 'other-school' },
  ]) {
    it(`demande une année courante si la référence est invalide (${JSON.stringify(invalid)})`, () => {
      years.getAcademicYears.and.returnValue(of([invalid]));
      const service = TestBed.inject(SchoolYearOnboardingService);
      service.ensure().subscribe();
      expect(service.status()).toBe('required');
      expect(service.complete(invalid)).toBeFalse();
    });
  }
  it('inclut le premier et le dernier jour de l’année scolaire', () => {
    const service = TestBed.inject(SchoolYearOnboardingService);
    for (const boundary of [
      { ...year, startsOn: '2026-10-18' },
      { ...year, endsOn: '2026-10-18' },
    ]) {
      years.getAcademicYears.and.returnValue(of([boundary]));
      service.ensure(true).subscribe();
      expect(service.status()).toBe('ready');
    }
  });
  it('revalide à la reconnexion, au changement de jour et après un archivage', () => {
    const service = TestBed.inject(SchoolYearOnboardingService);
    years.getAcademicYears.and.returnValue(of([year]));
    service.ensure().subscribe();
    years.getAcademicYears.and.returnValue(of([]));
    service.ensure(true).subscribe();
    expect(service.status()).toBe('required');
    years.getAcademicYears.and.returnValue(of([year]));
    service.ensure(true).subscribe();
    jasmine.clock().mockDate(new Date(2027, 8, 1, 12));
    service.ensure().subscribe();
    expect(service.status()).toBe('required');
    years.getAcademicYears.calls.reset();
    auth.session.set({ accessToken: token(undefined, 'reconnected') });
    service.ensure().subscribe();
    expect(years.getAcademicYears).toHaveBeenCalledOnceWith('school');
  });
  it('ignore les résultats et émissions d’une ancienne session', () => {
    const previous = new Subject<AcademicYear[]>();
    years.getAcademicYears.and.returnValue(previous);
    const service = TestBed.inject(SchoolYearOnboardingService);
    const stale = jasmine.createSpy('stale');
    service.ensure().subscribe(stale);
    auth.session.set({ accessToken: token(undefined, 'new') });
    establishments.getAccessible.and.returnValue(of([otherSchool]));
    years.getAcademicYears.and.returnValue(of([]));
    service.ensure().subscribe();
    previous.next([year]);
    previous.complete();
    expect(service.establishment()).toEqual(otherSchool);
    expect(service.status()).toBe('required');
    expect(stale).not.toHaveBeenCalled();
  });
  it('ignore une liste d’établissements reçue tardivement après changement de compte', () => {
    const previous = new Subject<Establishment[]>();
    establishments.getAccessible.and.returnValue(previous);
    const service = TestBed.inject(SchoolYearOnboardingService);
    service.ensure().subscribe();
    auth.session.set({ accessToken: token(undefined, 'new') });
    establishments.getAccessible.and.returnValue(of([otherSchool]));
    service.ensure().subscribe();
    previous.next([school]);
    previous.complete();
    expect(service.establishment()).toEqual(otherSchool);
    expect(service.pendingEstablishments()).toEqual([otherSchool]);
  });
  it('refuse une validation répétée et celle d’une ancienne session', () => {
    const service = TestBed.inject(SchoolYearOnboardingService);
    service.ensure().subscribe();
    auth.session.set({ accessToken: token(undefined, 'new') });
    expect(service.complete(year)).toBeFalse();
    service.ensure().subscribe();
    expect(service.complete(year)).toBeTrue();
    expect(service.complete(year)).toBeFalse();
  });
  for (const roles of [
    ['ROLE_ADMIN'],
    ['ROLE_PARENT'],
    ['ROLE_STAFF'],
    ['ROLE_ADMIN', 'ROLE_ESTABLISHMENT_ADMIN'],
  ]) {
    it(`ne force pas le parcours pour ${roles.join(', ')}`, () => {
      auth.session.set({ accessToken: token(roles) });
      const service = TestBed.inject(SchoolYearOnboardingService);
      service.ensure().subscribe();
      expect(establishments.getAccessible).not.toHaveBeenCalled();
      expect(years.getAcademicYears).not.toHaveBeenCalled();
    });
  }
});
