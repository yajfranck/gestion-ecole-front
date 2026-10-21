import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { GuardianChildDetailComponent } from './guardian-child-detail.component';
import { GuardianService } from '../../../service/guardian-service/guardian.service';
import { GuardianPortalService } from '../../../service/guardian-service/guardian-portal.service';
import { GuardianChildSummary } from '../../../models/guardian/guardian-portal.model';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';

describe('GuardianChildDetailComponent', () => {
  const yearId = '11111111-1111-1111-1111-111111111111';
  const previousYearId = '22222222-2222-2222-2222-222222222222';
  const years: AcademicYear[] = [
    { id: yearId, establishmentId: 'school', name: '2026-2027', startsOn: '2026-09-01', endsOn: '2027-06-30', enabled: true },
    { id: previousYearId, establishmentId: 'school', name: '2025-2026', startsOn: '2025-09-01', endsOn: '2026-06-30', enabled: true }
  ];
  const params = new BehaviorSubject(convertToParamMap({ studentId: 'child' }));
  const query = new BehaviorSubject(convertToParamMap({ academicYearId: yearId }));
  const children = { getMyChildren: jasmine.createSpy('getMyChildren') };
  const calendar = jasmine.createSpyObj('AcademicYearService', ['getAcademicYears']);
  const portal = jasmine.createSpyObj('GuardianPortalService', ['summary', 'fees', 'payments', 'attendance']);
  const summary = { studentId: 'child', establishmentId: 'school', academicYearId: yearId, firstName: 'Ada', lastName: 'Exemple', establishmentName: 'École', academicYearName: '2026-2027', schoolClassName: '6e', startsOn: '2026-09-01', endsOn: '2027-06-30', balances: [{ currency: 'XAF', amountBilled: 100, amountPaid: 30, balance: 70 }] } as GuardianChildSummary;
  beforeEach(() => {
    params.next(convertToParamMap({ studentId: 'child' }));
    query.next(convertToParamMap({ academicYearId: yearId }));
    children.getMyChildren.and.returnValue(of([{ id: 'child', establishmentId: 'school', firstName: 'Ada', lastName: 'Exemple' }]));
    calendar.getAcademicYears.calls.reset();
    calendar.getAcademicYears.and.returnValue(of(years));
    portal.summary.calls.reset();
    portal.fees.calls.reset();
    portal.attendance.calls.reset();
    portal.payments.calls.reset();
    portal.summary.and.returnValue(of(summary));
    portal.fees.and.returnValue(of([]));
    portal.attendance.and.returnValue(of({ records: [] }));
    portal.payments.and.returnValue(of([]));
    TestBed.configureTestingModule({ imports: [GuardianChildDetailComponent], providers: [provideZonelessChangeDetection(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: params, queryParamMap: query } },
      { provide: GuardianService, useValue: children }, { provide: GuardianPortalService, useValue: portal },
      { provide: AcademicYearService, useValue: calendar }] });
  });

  async function create() {
    const fixture = TestBed.createComponent(GuardianChildDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('affiche les soldes serveur et ne charge pas les historiques prématurément', async () => {
    const fixture = await create();
    expect(fixture.nativeElement.textContent).toContain('Ada Exemple');
    expect(fixture.nativeElement.textContent).toContain('6e');
    expect(fixture.componentInstance['summary']()?.balances[0].balance).toBe(70);
    expect(portal.fees).not.toHaveBeenCalled();
    expect(portal.attendance).not.toHaveBeenCalled();
  });

  it('ne consulte jamais un enfant non retourné par Mes enfants', async () => {
    params.next(convertToParamMap({ studentId: 'other' }));
    const fixture = await create();
    expect(portal.summary).not.toHaveBeenCalled();
    expect(calendar.getAcademicYears).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('n’est pas accessible');
  });

  it('ne tente pas une année arbitraire si aucune année n’est fournie', async () => {
    query.next(convertToParamMap({}));
    const fixture = await create();
    expect(portal.summary).not.toHaveBeenCalled();
    const select = fixture.nativeElement.querySelector('select[name="year"]') as HTMLSelectElement;
    expect(calendar.getAcademicYears).toHaveBeenCalledOnceWith('school');
    expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual([
      'Choisir une année scolaire', '2026-2027', '2025-2026'
    ]);
    expect(select.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Sélectionnez une année scolaire');
    expect(fixture.nativeElement.textContent).not.toContain('identifiant');
  });

  it('présélectionne l’année de l’URL lorsqu’elle appartient à la liste de l’établissement', async () => {
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('select[name="year"]').value).toBe(yearId);
    expect(portal.summary).toHaveBeenCalledOnceWith('school', 'child', yearId);
  });

  it('consulte l’année choisie dans la liste déroulante', async () => {
    query.next(convertToParamMap({}));
    const fixture = await create();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const select = fixture.nativeElement.querySelector('select[name="year"]') as HTMLSelectElement;
    select.value = previousYearId;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(navigate).toHaveBeenCalledOnceWith([], {
      relativeTo: TestBed.inject(ActivatedRoute), queryParams: { academicYearId: previousYearId }
    });
  });

  it('désactive la sélection pendant le chargement des années', async () => {
    const response = new Subject<AcademicYear[]>();
    calendar.getAcademicYears.and.returnValue(response);
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('select').disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('form button').disabled).toBeTrue();
    expect(portal.summary).not.toHaveBeenCalled();
    response.next(years);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('select').disabled).toBeFalse();
    expect(portal.summary).toHaveBeenCalledOnceWith('school', 'child', yearId);
  });

  it('affiche un état vide lorsque l’établissement ne propose aucune année scolaire', async () => {
    query.next(convertToParamMap({}));
    calendar.getAcademicYears.and.returnValue(of([]));
    const fixture = await create();
    expect(fixture.nativeElement.textContent).toContain('Aucune année scolaire disponible');
    expect(fixture.nativeElement.querySelector('select').disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('form button').disabled).toBeTrue();
    expect(portal.summary).not.toHaveBeenCalled();
  });

  it('permet de réessayer après une erreur de chargement des années', async () => {
    calendar.getAcademicYears.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Impossible de charger les années scolaires');
    expect(fixture.nativeElement.textContent).not.toContain('Aucune année scolaire disponible');
    expect(portal.summary).not.toHaveBeenCalled();

    calendar.getAcademicYears.and.returnValue(of(years));
    fixture.nativeElement.querySelector('.state-retry').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(calendar.getAcademicYears).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(portal.summary).toHaveBeenCalledOnceWith('school', 'child', yearId);
  });

  it('exclut les années archivées ou d’un autre établissement', async () => {
    query.next(convertToParamMap({}));
    calendar.getAcademicYears.and.returnValue(of([
      ...years,
      { ...years[0], id: 'archived', enabled: false },
      { ...years[0], id: 'other-school', establishmentId: 'other' }
    ]));
    const fixture = await create();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', yearId, previousYearId]);
  });

  it('refuse une année de l’URL absente de la liste et ne charge pas ses données', async () => {
    query.next(convertToParamMap({ academicYearId: '33333333-3333-3333-3333-333333333333' }));
    const fixture = await create();
    expect(portal.summary).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Cette année scolaire n’est pas disponible');
    expect(fixture.nativeElement.querySelector('[role="tablist"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('select').value).toBe('');
  });

  it('recharge les années de l’établissement lors du changement d’enfant et ignore une ancienne réponse', async () => {
    const response = new Subject<AcademicYear[]>();
    calendar.getAcademicYears.and.returnValue(response);
    children.getMyChildren.and.returnValue(of([
      { id: 'child', establishmentId: 'school', firstName: 'Ada', lastName: 'Exemple' },
      { id: 'other-child', establishmentId: 'other-school', firstName: 'Grace', lastName: 'Exemple' }
    ]));
    query.next(convertToParamMap({}));
    const fixture = await create();
    const otherYear = { ...years[0], id: 'other-year', establishmentId: 'other-school', name: 'Autre année' };
    calendar.getAcademicYears.and.returnValue(of([otherYear]));
    params.next(convertToParamMap({ studentId: 'other-child' }));
    fixture.detectChanges();
    await fixture.whenStable();
    response.next(years);
    fixture.detectChanges();

    expect(calendar.getAcademicYears).toHaveBeenCalledWith('other-school');
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', 'other-year']);
    expect(fixture.nativeElement.textContent).toContain('Grace Exemple');
  });

  it('charge les frais à la consultation et applique les filtres de paiement', async () => {
    const fixture = await create();
    const component = fixture.componentInstance;
    component['open']('fees');
    expect(portal.fees).toHaveBeenCalledOnceWith('school', 'child', yearId);
    component['from'] = '2026-09-01';
    component['to'] = '2026-09-30';
    component['loadPayments']({ chargeId: 'charge' } as never);
    expect(portal.payments).toHaveBeenCalledOnceWith('school', 'child', yearId, 'charge', '2026-09-01', '2026-09-30');
  });

  it('distingue absence, présence et absence de pointages sans commentaire interne', async () => {
    portal.attendance.and.returnValue(of({ records: [{ date: '2026-09-01', status: 'ABSENT', absenceJustified: true, parentComment: 'Certificat', comment: 'INTERNE' }] }));
    const fixture = await create();
    fixture.componentInstance['open']('attendance');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Absent');
    expect(fixture.nativeElement.textContent).toContain('Justifiée');
    expect(fixture.nativeElement.textContent).toContain('Certificat');
    expect(fixture.nativeElement.textContent).not.toContain('INTERNE');
    portal.attendance.and.returnValue(of({ records: [] }));
    fixture.componentInstance['loadAttendance']();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aucun pointage renseigné');
  });

  it('affiche les refus API et conserve les filtres', async () => {
    portal.attendance.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const fixture = await create();
    fixture.componentInstance['open']('attendance');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Accès refusé');
    expect(fixture.componentInstance['from']).toBe('2026-09-01');
  });

  it('permet de consulter les présences même si la synthèse financière est refusée', async () => {
    portal.summary.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const fixture = await create();
    fixture.componentInstance['open']('attendance');
    expect(portal.attendance).toHaveBeenCalledWith('school', 'child', yearId, jasmine.any(String), jasmine.any(String));
    expect(fixture.nativeElement.textContent).toContain('Cours et devoirs');
  });

  it('réinitialise les détails et ignore une ancienne réponse après changement d’année', async () => {
    const late = new Subject<never[]>();
    portal.fees.and.returnValue(late);
    const fixture = await create();
    fixture.componentInstance['open']('fees');
    query.next(convertToParamMap({ academicYearId: '22222222-2222-2222-2222-222222222222' }));
    fixture.detectChanges();
    await fixture.whenStable();
    late.next([]);
    expect(fixture.componentInstance['fees']()).toBeNull();
  });
});
