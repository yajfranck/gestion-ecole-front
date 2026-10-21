import { withPermissionChecks } from '../testing/permission-fixture';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { LicenseAccessService } from './license-access.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspaceContextService } from '../shared/workspace-context.service';
import { LicenseService } from '../service/license-service/license.service';
import { PlatformLicense } from '../models/license/license.model';

describe('LicenseAccessService', () => {
  const authorities = signal(['can_license_read', 'can_license_offer_read', 'can_learning_content_read']);
  const licenses = [{ id: 1, establishmentId: 'school', offerId: 'offer', state: 'ACTIVE' }] as PlatformLicense[];
  const api = { list: jasmine.createSpy('list'), offers: jasmine.createSpy('offers') };
  beforeEach(() => {
    authorities.set(['can_license_read', 'can_license_offer_read', 'can_learning_content_read']);
    api.list.and.returnValue(of(licenses));
    api.offers.and.returnValue(of([{ id: 'offer', features: ['LEARNING_CONTENT'] }]));
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(),
      { provide: LicenseService, useValue: api },
      { provide: WorkspaceAccessService, useValue: withPermissionChecks({ authorities, has: (permission: string) => authorities().includes(permission), hasPermission: () => true, hasPlatformPermission: () => false }) }] });
  });

  function start() {
    const context = TestBed.inject(WorkspaceContextService);
    context.current.set({ establishmentId: 'school', establishmentName: 'École', academicYearId: null, academicYearName: null });
    const service = TestBed.inject(LicenseAccessService);
    TestBed.tick();
    return { service, context };
  }

  it('combine permission et capacité sans déduire les offres', () => {
    const { service } = start();
    expect(service.decision('LEARNING_CONTENT', 'school')).toBe('allowed');
    expect(service.decision('TUITION', 'school')).toBe('blocked');
    expect(service.decision('LEARNING_CONTENT', 'other')).toBe('unknown');
    expect(service.canUse('can_learning_content_read', 'LEARNING_CONTENT', 'school')).toBeTrue();
    expect(api.offers).toHaveBeenCalled();
  });

  it('ne conserve pas la licence de l’établissement précédent', () => {
    const { service, context } = start();
    const response = new Subject<PlatformLicense[]>();
    api.list.and.returnValue(response);
    context.current.set({ establishmentId: 'other', establishmentName: 'Autre', academicYearId: null, academicYearName: null });
    TestBed.tick();
    expect(service.licenses()).toBeNull();
    expect(service.decision('LEARNING_CONTENT', 'other')).toBe('unknown');
    response.next([]);
    response.complete();
    expect(service.decision('LEARNING_CONTENT', 'other')).toBe('blocked');
  });

  it('ne déduit aucune capacité pour un administrateur local sans catalogue', () => {
    authorities.set(['can_license_read']);
    const { service } = start();
    expect(service.decision('LEARNING_CONTENT', 'school')).toBe('unknown');
  });

  it('utilise les états effectifs suspendu expiré et à venir sans les recalculer', () => {
    const { service } = start();
    for (const state of ['SUSPENDED', 'EXPIRED', 'UPCOMING'] as const) {
      service.licenses.set([{ ...licenses[0], state }]);
      expect(service.decision('LEARNING_CONTENT', 'school')).toBe('blocked');
    }
  });
});