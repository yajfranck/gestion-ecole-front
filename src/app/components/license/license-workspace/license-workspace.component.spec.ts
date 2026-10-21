import { withPermissionChecks } from '../../../testing/permission-fixture';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { By } from '@angular/platform-browser';
import { EstablishmentLicenseFormComponent } from '../../establishment/establishment-license-form/establishment-license-form.component';
import { LicenseWorkspaceComponent } from './license-workspace.component';
import { LicenseAccessService } from '../../../core/license-access.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { LicenseService } from '../../../service/license-service/license.service';
import { EstablishmentService } from '../../../service/establishment-service/establishment.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { PlatformLicense } from '../../../models/license/license.model';

describe('LicenseWorkspaceComponent', () => {
  const schoolId = '76fa05db-7df9-4f32-8a10-ab70103ab281';
  const authorities = signal(['can_establishment_read', 'can_license_read', 'can_license_assign', 'can_license_offer_read', 'can_license_suspend', 'can_license_reactivate', 'can_license_end', 'can_license_event_read']);
  const license = {
    establishmentId: signal<string | null>(schoolId), licenses: signal<PlatformLicense[]>([]), offers: signal([{ id: 'offer', name: 'Offre serveur', features: ['TUITION'] }]),
    loading: signal(false), error: signal<string | null>(null), canRead: jasmine.createSpy('canRead'), refresh: jasmine.createSpy('refresh')
  };
  const api = jasmine.createSpyObj('LicenseService', ['assign', 'transition', 'events', 'offers', 'list']);
  const establishments = { getAccessible: jasmine.createSpy('getAccessible') };
  beforeEach(() => {
    authorities.set(['can_establishment_read', 'can_license_read', 'can_license_assign', 'can_license_offer_read', 'can_license_suspend', 'can_license_reactivate', 'can_license_end', 'can_license_event_read']);
    license.canRead.and.returnValue(true);
    license.refresh.and.returnValue(of({ licenses: [] }));
    license.licenses.set([]);
    license.loading.set(false);
    for (const method of Object.values(api)) (method as jasmine.Spy).calls.reset();
    api.assign.and.returnValue(of({ id: 1, establishmentId: schoolId }));
    api.offers.and.returnValue(of([{ id: 'offer', name: 'Offre serveur', enabled: true, features: ['TUITION'] }]));
    api.list.and.returnValue(of([]));
    api.transition.and.returnValue(of({ id: 1 }));
    api.events.and.returnValue(of([]));
    establishments.getAccessible.calls.reset();
    establishments.getAccessible.and.returnValue(of([{ id: schoolId, name: 'École', code: 'S1', enabled: true }]));
    TestBed.configureTestingModule({ imports: [LicenseWorkspaceComponent], providers: [provideZonelessChangeDetection(),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ establishmentId: schoolId })) } },
      { provide: LicenseAccessService, useValue: license }, { provide: WorkspaceAccessService, useValue: withPermissionChecks({ authorities, has: (permission: string) => authorities().includes(permission), hasPermission: (permission: string) => authorities().includes(permission), hasPlatformPermission: () => false }) },
      { provide: EstablishmentService, useValue: establishments }, { provide: LicenseService, useValue: api }] });
  });

  async function create() {
    const fixture = TestBed.createComponent(LicenseWorkspaceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('restaure le contexte par URL sans demander les années scolaires', async () => {
    await create();
    expect(TestBed.inject(WorkspaceContextService).current()?.establishmentId).toBe(schoolId);
    expect(establishments.getAccessible).toHaveBeenCalledTimes(1);
  });

  it('refuse un accès direct sans droit et sans requête', async () => {
    license.canRead.and.returnValue(false);
    const fixture = await create();
    expect(establishments.getAccessible).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('n’est pas autorisée');
  });

  it('masque la gestion sans permission de modification', async () => {
    authorities.set(['can_license_read']);
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(api.assign).not.toHaveBeenCalled();
  });

  async function openAssignment() {
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    (fixture.nativeElement.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const form = fixture.debugElement.query(By.directive(EstablishmentLicenseFormComponent)).componentInstance as EstablishmentLicenseFormComponent;
    return { fixture, form };
  }

  it('attribue l’offre depuis la modale et actualise les licences', async () => {
    const { fixture, form } = await openAssignment();
    expect((fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).open).toBeTrue();
    form['offerId'] = 'offer';
    form['register']();
    fixture.detectChanges();
    expect(api.assign).toHaveBeenCalledWith(schoolId, { offerId: 'offer' });
    expect(license.refresh).toHaveBeenCalledWith(schoolId);
    expect(fixture.componentInstance['message']()).toContain('mise à jour');
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
  });

  it('permet le renouvellement même si une licence existe déjà', async () => {
    api.list.and.returnValue(of([{ id: 2, state: 'ACTIVE', establishmentId: schoolId }]));
    const { form } = await openAssignment();
    form['offerId'] = 'offer';
    form['register']();
    expect(api.assign).toHaveBeenCalledWith(schoolId, { offerId: 'offer' });
  });

  it('conserve les champs et la modale après un conflit de période', async () => {
    api.assign.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    const { fixture, form } = await openAssignment();
    form['offerId'] = 'offer';
    form['register']();
    fixture.detectChanges();
    expect(form['offerId']).toBe('offer');
    expect(fixture.nativeElement.querySelector('dialog [role="alert"]')?.textContent).toContain('conflit');
    expect(fixture.componentInstance['busy']()).toBeFalse();
    expect((fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).open).toBeTrue();
  });

  it('refuse la fermeture de la modale pendant l’enregistrement', async () => {
    const response = new Subject<never>();
    api.assign.and.returnValue(response);
    const { fixture, form } = await openAssignment();
    form['offerId'] = 'offer';
    form['register']();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(dialog.open).toBeTrue();
    expect(fixture.componentInstance['assignmentOpen']()).toBeTrue();
  });

  it('charge l’audit seulement à la demande', async () => {
    const fixture = await create();
    expect(api.events).not.toHaveBeenCalled();
    fixture.componentInstance['history']({ id: 3, establishmentId: schoolId } as PlatformLicense);
    expect(api.events).toHaveBeenCalledWith(schoolId, 3);
  });
});