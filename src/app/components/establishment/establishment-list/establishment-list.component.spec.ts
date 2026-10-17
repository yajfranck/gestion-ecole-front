import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EstablishmentsComponent } from './establishment-list.component';
import { EstablishmentService } from '../../../service/establishment-service/establishment.service';
import { LicenseService } from '../../../service/license-service/license.service';

describe('EstablishmentsComponent', () => {
  const establishment = {
    id: 'school-1', code: 'SCHOOL-1', name: 'École Exemple', enabled: true,
    createdAt: '', updatedAt: ''
  };
  const offer = { id: 'offer-1', code: 'OFFER-1', name: 'Offre disponible', features: [], enabled: true, createdAt: '' };
  const establishments = jasmine.createSpyObj('EstablishmentService', ['getAccessible', 'create', 'deactivate']);
  const licenses = jasmine.createSpyObj('LicenseService', ['offers', 'assign']);

  beforeEach(() => {
    for (const method of Object.values(establishments)) (method as jasmine.Spy).calls.reset();
    for (const method of Object.values(licenses)) (method as jasmine.Spy).calls.reset();
    establishments.getAccessible.and.returnValue(of([establishment]));
    establishments.create.and.returnValue(of({ establishment, administratorInvitation: { employeeId: 'employee-1', status: 'INVITATION_SENT' } }));
    establishments.deactivate.and.returnValue(of(void 0));
    licenses.offers.and.returnValue(of([offer]));
    licenses.assign.and.returnValue(of({ id: 1 }));
    TestBed.configureTestingModule({
      imports: [EstablishmentsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: EstablishmentService, useValue: establishments },
        { provide: LicenseService, useValue: licenses }
      ]
    });
  });

  function create() {
    const fixture = TestBed.createComponent(EstablishmentsComponent);
    fixture.detectChanges();
    return fixture;
  }

  function fillRequiredFields(component: EstablishmentsComponent): void {
    component['code'] = 'SCHOOL-1';
    component['name'] = 'École Exemple';
    component['administratorEmployeeNumber'] = 'ADM-1';
    component['administratorFirstName'] = 'Ada';
    component['administratorLastName'] = 'Lovelace';
    component['administratorEmail'] = 'ada@example.org';
  }

  it('propose les offres après création avec l’établissement retourné par l’API', () => {
    const fixture = create();
    fillRequiredFields(fixture.componentInstance);

    fixture.componentInstance['createEstablishment']();
    fixture.detectChanges();

    expect(licenses.offers).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance['createdEstablishment']()).toEqual(establishment);
    expect(fixture.nativeElement.textContent).toContain('Ajouter une licence maintenant');
    expect(fixture.nativeElement.querySelector('#new-license-offer')).toBeTruthy();
  });

  it('attribue l’offre choisie au nouvel établissement et transmet les dates facultatives', () => {
    const fixture = create();
    fillRequiredFields(fixture.componentInstance);
    fixture.componentInstance['createEstablishment']();
    fixture.componentInstance['licenseOfferId'] = offer.id;
    fixture.componentInstance['licenseValidFrom'] = '2027-01-02T12:30';
    fixture.componentInstance['licenseValidUntil'] = '2027-12-31T12:30';

    fixture.componentInstance['assignCreatedLicense']();

    expect(licenses.assign).toHaveBeenCalledWith('school-1', {
      offerId: offer.id,
      validFrom: new Date('2027-01-02T12:30').toISOString(),
      validUntil: new Date('2027-12-31T12:30').toISOString()
    });
    expect(fixture.componentInstance['licenseSuccess']()).toBeTrue();
  });

  it('conserve l’établissement et les choix si l’API refuse la période', () => {
    licenses.assign.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    const fixture = create();
    fillRequiredFields(fixture.componentInstance);
    fixture.componentInstance['createEstablishment']();
    fixture.componentInstance['licenseOfferId'] = offer.id;
    fixture.componentInstance['licenseValidFrom'] = '2027-01-02T12:30';

    fixture.componentInstance['assignCreatedLicense']();
    fixture.detectChanges();

    expect(fixture.componentInstance['createdEstablishment']()?.id).toBe('school-1');
    expect(fixture.componentInstance['licenseOfferId']).toBe(offer.id);
    expect(fixture.componentInstance['licenseError']()).toContain('conflit');
    expect(fixture.nativeElement.textContent).toContain('Ajouter une licence maintenant');
  });

  it('permet de passer l’étape et conserve un lien vers la gestion ultérieure', () => {
    const fixture = create();
    fillRequiredFields(fixture.componentInstance);
    fixture.componentInstance['createEstablishment']();

    fixture.componentInstance['skipLicenseAssignment']();
    fixture.detectChanges();

    expect(licenses.assign).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('créé sans licence');
    expect(fixture.nativeElement.querySelector('a[href="/establishments/school-1/license"]')).toBeTruthy();
  });
});