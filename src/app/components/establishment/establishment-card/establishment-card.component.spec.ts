import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { EstablishmentCardComponent } from './establishment-card.component';

describe('EstablishmentCardComponent', () => {
  const establishment = { id: 'school-1', name: 'École Exemple', code: 'S1', enabled: true, createdAt: '', updatedAt: '' };
  const permissions = ['can_establishment_read', 'can_establishment_update', 'can_establishment_delete', 'can_license_read', 'can_license_assign', 'can_license_offer_read'];

  beforeEach(() => TestBed.configureTestingModule({
    imports: [EstablishmentCardComponent],
    providers: [provideZonelessChangeDetection(), provideRouter([]), providePermissionFixture(permissions, ['school-1'], permissions, true)]
  }));

  function create() {
    const fixture = TestBed.createComponent(EstablishmentCardComponent);
    fixture.componentRef.setInput('establishment', establishment);
    fixture.componentRef.setInput('summary', { status: 'NONE', offerName: null, validFrom: null, validUntil: null });
    fixture.detectChanges();
    return fixture;
  }

  it('conserve les destinations des liens avec des noms accessibles et des infobulles', () => {
    const root = create().nativeElement as HTMLElement;
    const links = [...root.querySelectorAll<HTMLAnchorElement>('a')];
    expect(links.map(link => link.getAttribute('href'))).toEqual([
      '/establishments/school-1', '/establishments/school-1/license', '/establishments/school-1?edit=1'
    ]);
    for (const action of root.querySelectorAll('a, button')) {
      expect(action.getAttribute('aria-label')).toBeTruthy();
      expect(action.getAttribute('title')).toBe(action.getAttribute('aria-label'));
      expect(action.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(action.textContent?.trim()).toBe('');
    }
  });

  it('ouvre l’enregistrement de licence même depuis le SVG et conserve le bouton comme cible de retour du focus', () => {
    const fixture = create();
    const registered = jasmine.createSpy('registered');
    fixture.componentInstance.registerLicense.subscribe(registered);
    const button = fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
    button.querySelector('svg')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(registered).toHaveBeenCalledOnceWith({ establishment, trigger: button });
  });

  it('émet la désactivation et bloque tout nouvel envoi pendant son traitement', () => {
    const fixture = create();
    const deactivate = jasmine.createSpy('deactivate');
    fixture.componentInstance.deactivate.subscribe(deactivate);
    const button = fixture.nativeElement.querySelector('button[aria-label="Désactiver"]') as HTMLButtonElement;
    button.click();
    expect(deactivate).toHaveBeenCalledOnceWith(establishment);
    fixture.componentRef.setInput('deactivating', true);
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Désactivation…');
    button.click();
    expect(deactivate).toHaveBeenCalledTimes(1);
  });

  it('respecte les permissions pour les actions illustrées', () => {
    const access = TestBed.inject(WorkspaceAccessService);
    spyOn(access, 'hasPermission').and.returnValue(false);
    spyOn(access, 'hasPlatformPermission').and.returnValue(false);
    const root = create().nativeElement as HTMLElement;
    expect(root.querySelectorAll('a, button')).toHaveSize(0);
  });

  it('ne propose pas de désactivation pour un établissement inactif', () => {
    const fixture = create();
    fixture.componentRef.setInput('establishment', { ...establishment, enabled: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[aria-label="Désactiver"]')).toBeNull();
  });
});
