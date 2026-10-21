import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { LicenseService } from '../../../service/license-service/license.service';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { EstablishmentLicenseFormComponent } from './establishment-license-form.component';

describe('EstablishmentLicenseFormComponent', () => {
  const establishment = { id: '76fa05db-7df9-4f32-8a10-ab70103ab281', name: 'École Exemple', code: 'SCHOOL-1', enabled: true, createdAt: '', updatedAt: '' };
  const offer = { id: 'offer-1', name: 'Offre disponible', enabled: true };
  const api = jasmine.createSpyObj('LicenseService', ['offers', 'list', 'assign']);

  beforeEach(() => {
    for (const spy of Object.values(api)) (spy as jasmine.Spy).calls.reset();
    api.offers.and.returnValue(of([offer]));
    api.list.and.returnValue(of([]));
    api.assign.and.returnValue(of({ id: 1, establishmentId: establishment.id }));
    TestBed.configureTestingModule({
      imports: [EstablishmentLicenseFormComponent],
      providers: [provideZonelessChangeDetection(),
        providePermissionFixture(['can_license_assign', 'can_license_offer_read', 'can_license_read']),
        { provide: LicenseService, useValue: api }]
    });
  });

  async function create() {
    const fixture = TestBed.createComponent(EstablishmentLicenseFormComponent);
    fixture.componentRef.setInput('establishment', establishment);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('permet de réessayer le chargement du catalogue après une erreur', async () => {
    api.offers.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Impossible de charger');
    api.offers.and.returnValue(of([offer, { ...offer, id: 'disabled', enabled: false }]));
    (fixture.nativeElement.querySelector('.state-retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('option').length).toBe(2);
    expect(api.assign).not.toHaveBeenCalled();
  });

  it('émet l’état occupé et empêche une seconde attribution pendant l’envoi', async () => {
    const response = new Subject<never>();
    api.assign.and.returnValue(response);
    const fixture = await create();
    const busy = jasmine.createSpy('busy');
    fixture.componentInstance.busyChange.subscribe(busy);
    fixture.componentInstance['offerId'] = offer.id;
    fixture.componentInstance['register']();
    fixture.componentInstance['register']();
    expect(busy).toHaveBeenCalledOnceWith(true);
    expect(api.assign).toHaveBeenCalledTimes(1);
    response.error(new HttpErrorResponse({ status: 409 }));
    expect(busy.calls.allArgs()).toEqual([[true], [false]]);
    expect(fixture.componentInstance['offerId']).toBe(offer.id);
    expect(fixture.componentInstance['error']()).toContain('conflit');
  });

  it('refuse une date invalide pour un renouvellement avant tout appel API', async () => {
    const fixture = await create();
    fixture.componentRef.setInput('allowReplacement', true);
    fixture.detectChanges();
    fixture.componentInstance['offerId'] = offer.id;
    fixture.componentInstance['validFrom'] = 'invalid';
    fixture.componentInstance['register']();
    expect(api.assign).not.toHaveBeenCalled();
    expect(fixture.componentInstance['error']()).toContain('période');
  });
});
