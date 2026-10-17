import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LicenseWorkspaceComponent } from './license-workspace.component';
import { LicenseAccessService } from '../../../core/license-access.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { LicenseService } from '../../../service/license-service/license.service';
import { EstablishmentService } from '../../../service/establishment-service/establishment.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { PlatformLicense } from '../../../models/license/license.model';

describe('LicenseWorkspaceComponent', () => {
  const authorities = signal(['ROLE_ADMIN']);
  const license = {
    establishmentId: signal<string | null>('school'), licenses: signal<PlatformLicense[]>([]), offers: signal([{ id: 'offer', name: 'Offre serveur', features: ['TUITION'] }]),
    loading: signal(false), error: signal<string | null>(null), canRead: jasmine.createSpy('canRead'), refresh: jasmine.createSpy('refresh')
  };
  const api = jasmine.createSpyObj('LicenseService', ['assign', 'transition', 'events']);
  const establishments = { getAccessible: jasmine.createSpy('getAccessible') };
  beforeEach(() => {
    authorities.set(['ROLE_ADMIN']);
    license.canRead.and.returnValue(true);
    license.refresh.and.returnValue(of({ licenses: [] }));
    license.licenses.set([]);
    license.loading.set(false);
    for (const method of Object.values(api)) (method as jasmine.Spy).calls.reset();
    api.assign.and.returnValue(of({ id: 1 }));
    api.transition.and.returnValue(of({ id: 1 }));
    api.events.and.returnValue(of([]));
    establishments.getAccessible.calls.reset();
    establishments.getAccessible.and.returnValue(of([{ id: 'school', name: 'École', code: 'S1', enabled: true }]));
    TestBed.configureTestingModule({ imports: [LicenseWorkspaceComponent], providers: [provideZonelessChangeDetection(),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ establishmentId: 'school' })) } },
      { provide: LicenseAccessService, useValue: license }, { provide: WorkspaceAccessService, useValue: { authorities } },
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
    expect(TestBed.inject(WorkspaceContextService).current()?.establishmentId).toBe('school');
    expect(establishments.getAccessible).toHaveBeenCalledTimes(1);
  });

  it('refuse un accès direct sans droit et sans requête', async () => {
    license.canRead.and.returnValue(false);
    const fixture = await create();
    expect(establishments.getAccessible).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('n’est pas autorisée');
  });

  it('laisse la gestion uniquement à ADMIN', async () => {
    authorities.set(['can_license_read']);
    const fixture = await create();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    fixture.componentInstance['offerId'] = 'offer';
    fixture.componentInstance['assign']();
    expect(api.assign).not.toHaveBeenCalled();
  });

  it('attribue l’offre sélectionnée et actualise les licences', async () => {
    const fixture = await create();
    fixture.componentInstance['offerId'] = 'offer';
    fixture.componentInstance['assign']();
    expect(api.assign).toHaveBeenCalledWith('school', { offerId: 'offer' });
    expect(license.refresh).toHaveBeenCalledWith('school');
    expect(fixture.componentInstance['message']()).toContain('mise à jour');
  });

  it('conserve les champs après un conflit de période', async () => {
    api.assign.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    const fixture = await create();
    fixture.componentInstance['offerId'] = 'offer';
    fixture.componentInstance['assign']();
    expect(fixture.componentInstance['offerId']).toBe('offer');
    expect(fixture.componentInstance['error']()).toContain('Conflit');
    expect(fixture.componentInstance['busy']()).toBeFalse();
  });

  it('charge l’audit seulement à la demande', async () => {
    const fixture = await create();
    expect(api.events).not.toHaveBeenCalled();
    fixture.componentInstance['history']({ id: 3, establishmentId: 'school' } as PlatformLicense);
    expect(api.events).toHaveBeenCalledWith('school', 3);
  });
});