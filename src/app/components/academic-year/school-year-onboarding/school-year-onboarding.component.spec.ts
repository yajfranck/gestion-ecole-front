import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { SchoolYearOnboardingComponent } from './school-year-onboarding.component';
import { SchoolYearOnboardingService } from '../../../core/school-year-onboarding.service';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';

describe('SchoolYearOnboardingComponent', () => {
  const school = { id: 'school', name: 'École Les Acacias', code: 'ECOLE-001' };
  const otherSchool = { id: 'other-school', name: 'École Les Lilas', code: 'ECOLE-002' };
  const service = {
    managedEstablishments: signal([school]),
    pendingEstablishments: signal([school]),
    loading: signal(false),
    status: signal('required'),
    establishmentId: signal('school'),
    establishment: signal({ id: 'school', name: 'École Les Acacias', code: 'ECOLE-001' }),
    error: signal<string | null>(null),
    canConfigureSchoolYear: () => true,
    ensure: jasmine.createSpy('ensure'),
    complete: jasmine.createSpy('complete'),
  };
  const api = { createAcademicYear: jasmine.createSpy('createAcademicYear') };
  beforeEach(() => {
    service.status.set('required');
    service.error.set(null);
    service.managedEstablishments.set([school]);
    service.pendingEstablishments.set([school]);
    service.establishment.set(school);
    service.establishmentId.set(school.id);
    service.complete.calls.reset();
    service.ensure.calls.reset();
    service.ensure.and.returnValue(of('required'));
    service.complete.and.callFake(() => {
      service.status.set('ready');
      return true;
    });
    TestBed.configureTestingModule({
      imports: [SchoolYearOnboardingComponent],
      providers: [providePermissionFixture(['can_academic_year_create', 'can_academic_year_read'], ['school', 'school-1', 'other-school']),
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: SchoolYearOnboardingService, useValue: service },
        { provide: AcademicYearService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ returnUrl: '/establishments/school/students' }),
            },
          },
        },
      ],
    });
  });
  it('affiche d’abord le formulaire de première année', () => {
    const fixture = TestBed.createComponent(SchoolYearOnboardingComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#year-name')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Enregistrer l’année et continuer');
  });
  it('affiche le nom et le code de l’établissement au-dessus du formulaire', () => {
    const fixture = TestBed.createComponent(SchoolYearOnboardingComponent);
    fixture.detectChanges();
    const identity = fixture.nativeElement.querySelector(
      '[aria-label="Établissement à configurer"]',
    ) as HTMLElement;
    expect(identity.textContent).toContain('École Les Acacias');
    expect(identity.textContent).toContain('ECOLE-001');
    expect(
      identity.compareDocumentPosition(
        fixture.nativeElement.querySelector('app-academic-year-form'),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
  it('reste sur la configuration et renouvelle le formulaire pour le deuxième établissement', () => {
    service.managedEstablishments.set([school, otherSchool]);
    service.pendingEstablishments.set([school, otherSchool]);
    const fixture = TestBed.createComponent(SchoolYearOnboardingComponent);
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture.detectChanges();
    const first = fixture.nativeElement.querySelector('app-academic-year-form');
    service.complete.and.callFake(() => {
      service.pendingEstablishments.set([otherSchool]);
      service.establishment.set(otherSchool);
      service.establishmentId.set(otherSchool.id);
      return true;
    });
    fixture.componentInstance['onCreated']({
      id: 'year',
      establishmentId: 'school',
      enabled: true,
    } as never);
    fixture.detectChanges();
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('1 / 2 établissements configurés');
    expect(
      fixture.nativeElement.querySelector('[aria-label="Établissement à configurer"]').textContent,
    ).toContain(otherSchool.name);
    expect(fixture.nativeElement.querySelector('app-academic-year-form')).not.toBe(first);
  });
  it('ne montre pas de formulaire après un refus de vérification et permet de réessayer', () => {
    service.status.set('error');
    service.error.set('Licence inactive');
    service.ensure.and.returnValue(of('error'));
    const fixture = TestBed.createComponent(SchoolYearOnboardingComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-academic-year-form')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Licence inactive',
    );
    fixture.nativeElement.querySelector('.state-retry').click();
    expect(service.ensure).toHaveBeenCalledWith(true);
  });
  it('reprend le parcours demandé uniquement après enregistrement de l’année', () => {
    const fixture = TestBed.createComponent(SchoolYearOnboardingComponent);
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture.detectChanges();
    expect(navigate).not.toHaveBeenCalled();
    fixture.componentInstance['onCreated']({
      id: 'year',
      establishmentId: 'school',
      enabled: true,
    } as never);
    expect(service.complete).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledOnceWith('/establishments/school/students', {
      replaceUrl: true,
    });
  });
});
