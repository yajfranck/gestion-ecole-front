import { ToastService } from '../../../service/toast-service/toast.service';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { EstablishmentsComponent } from './establishment-list.component';
import { EstablishmentService } from '../../../service/establishment-service/establishment.service';
import { LicenseService } from '../../../service/license-service/license.service';
import { EstablishmentLicenseFormComponent } from '../establishment-license-form/establishment-license-form.component';

describe('EstablishmentsComponent', () => {
  const establishment = { id: '76fa05db-7df9-4f32-8a10-ab70103ab281', code: 'SCHOOL-1', name: 'École Exemple', enabled: true, createdAt: '', updatedAt: '' };
  const second = { id: 'school-2', code: 'OTHER', name: 'Collège Autre', enabled: false, createdAt: '', updatedAt: '' };
  const offer = { id: 'offer-1', code: 'OFFER-1', name: 'Offre disponible', features: [], enabled: true, createdAt: '' };
  const activeLicense = { id: 1, establishmentId: establishment.id, offerId: 'offer-1', offerName: 'Offre disponible', validFrom: '2026-01-01T00:00:00Z', validUntil: '2027-01-01T00:00:00Z', state: 'ACTIVE' };
  const establishments = jasmine.createSpyObj('EstablishmentService', ['getAccessible', 'create', 'deactivate']);
  const licenses = jasmine.createSpyObj('LicenseService', ['list', 'offers', 'assign']);
  const all = ['can_establishment_read', 'can_establishment_update', 'can_establishment_onboard', 'can_establishment_delete', 'can_license_assign', 'can_license_offer_read', 'can_license_read'];

  function setup(permissions = all, registration = false, id: string | null = establishment.id, state: object | null = { establishment }) {
    const paramMap = convertToParamMap(id ? { establishmentId: id } : {});
    TestBed.configureTestingModule({
      imports: [EstablishmentsComponent],
      providers: [providePermissionFixture(permissions, ['school', establishment.id, 'school-2']),
        provideZonelessChangeDetection(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { licenseRegistration: registration }, paramMap }, paramMap: of(paramMap) } },
        { provide: EstablishmentService, useValue: establishments },
        { provide: LicenseService, useValue: licenses }]
    });
    spyOn(TestBed.inject(Location), 'getState').and.returnValue(state);
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  }

  beforeEach(() => {
    for (const method of [...Object.values(establishments), ...Object.values(licenses)]) (method as jasmine.Spy).calls.reset();
    establishments.getAccessible.and.returnValue(of([establishment]));
    establishments.create.and.returnValue(of({ establishment, administratorInvitation: { employeeId: 'e', status: 'INVITATION_SENT' } }));
    establishments.deactivate.and.returnValue(of(void 0));
    licenses.list.and.returnValue(of([activeLicense]));
    licenses.offers.and.returnValue(of([offer]));
    licenses.assign.and.returnValue(of({ ...activeLicense, id: 2 }));
  });

  function create() {
    const fixture = TestBed.createComponent(EstablishmentsComponent);
    fixture.detectChanges();
    return fixture;
  }

  const createRequest = {
    code: 'SCHOOL-1',
    name: 'École Exemple',
    administrator: { employeeNumber: 'ADM-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.org' }
  };

  function text(fixture: { nativeElement: HTMLElement }): string {
    return fixture.nativeElement.textContent ?? '';
  }

  it('affiche le portail avec une carte, le statut de licence et les actions autorisées', () => {
    setup();
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Portail des établissements');
    expect(text(fixture)).toContain('Gérez vos établissements scolaires depuis un espace centralisé');
    expect(el.querySelector('app-establishment-card')).toBeTruthy();
    expect(el.querySelector('[data-testid="license-status"]')?.textContent).toContain('Licence active');
    expect(el.querySelector('a[aria-label="Accéder à l’établissement"]')).toBeTruthy();
    expect(el.querySelector('a[aria-label="Gérer la licence"]')).toBeTruthy();
    expect(el.querySelector('a[aria-label="Modifier l’établissement"]')).toBeTruthy();
    expect(text(fixture)).toContain('Voir les détails');
    expect(text(fixture)).not.toContain('Enregistrer la licence');
  });

  it('met en avant l’enregistrement quand aucune licence n’existe et propose de reprendre', () => {
    licenses.list.and.returnValue(of([]));
    setup();
    const fixture = create();
    expect(text(fixture)).toContain('Licence non enregistrée');
    expect(text(fixture)).toContain('en attente de licence');
    expect(text(fixture)).toContain('Reprendre l’enregistrement');
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find((b) => b.textContent?.includes('Reprendre'))?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog app-establishment-license-form')).toBeTruthy();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('affiche un statut inconnu sans lire les licences si can_license_read manque', () => {
    setup(['can_establishment_read']);
    const fixture = create();
    expect(licenses.list).not.toHaveBeenCalled();
    expect(text(fixture)).toContain('Licence non consultable');
  });

  it('propose la création depuis l’état vide uniquement avec can_establishment_onboard', () => {
    establishments.getAccessible.and.returnValue(of([]));
    setup();
    expect(text(create())).toContain('Créer mon premier établissement');
    TestBed.resetTestingModule();
    setup(['can_establishment_read']);
    const fixture = create();
    expect(text(fixture)).not.toContain('Créer mon premier établissement');
    expect(text(fixture)).toContain('Aucun établissement accessible');
  });

  it('affiche une erreur avec réessai', () => {
    establishments.getAccessible.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    setup();
    const fixture = create();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Impossible de charger');
    expect(fixture.nativeElement.querySelector('.state-retry')).toBeTruthy();
  });

  it('filtre par nom et état sans nouvel appel API', () => {
    establishments.getAccessible.and.returnValue(of([establishment, second]));
    setup();
    const fixture = create();
    const component = fixture.componentInstance;
    component['searchTerm'].set('collège');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-establishment-card').length).toBe(1);
    component['clearFilters']();
    component['selectedStatus'].set('enabled');
    fixture.detectChanges();
    expect(text(fixture)).not.toContain('Collège Autre');
    expect(establishments.getAccessible).toHaveBeenCalledTimes(1);
  });

  it('enchaîne les modales de création puis de licence sans changer de page', async () => {
    licenses.list.and.returnValue(of([]));
    setup();
    const fixture = create();
    (fixture.nativeElement.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const values = {
      code: createRequest.code,
      name: createRequest.name,
      administratorEmployeeNumber: createRequest.administrator.employeeNumber,
      administratorFirstName: createRequest.administrator.firstName,
      administratorLastName: createRequest.administrator.lastName,
      administratorEmail: createRequest.administrator.email
    };
    for (const [name, value] of Object.entries(values)) {
      const input = fixture.nativeElement.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    fixture.nativeElement.querySelector('dialog form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(establishments.create).toHaveBeenCalledOnceWith(createRequest);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-establishment-form')).toBeNull();
    expect((fixture.nativeElement.querySelector('dialog') as HTMLDialogElement).open).toBeTrue();
    expect(fixture.nativeElement.querySelector('dialog app-establishment-license-form')).toBeTruthy();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    expect(establishments.getAccessible).toHaveBeenCalledTimes(1);
  });

  it('ouvre la modale depuis le bouton de création et rend le focus après Échap', async () => {
    setup();
    const fixture = create();
    const trigger = fixture.nativeElement.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement;
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBeTrue();
    expect(dialog.classList.contains('max-w-3xl')).toBeTrue();
    expect(dialog.querySelector('app-establishment-form')).toBeTruthy();
    expect(document.activeElement?.id).toBe('establishment-code');
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(establishments.create).not.toHaveBeenCalled();
  });

  it('ouvre aussi la modale depuis l’état vide et permet d’annuler', async () => {
    establishments.getAccessible.and.returnValue(of([]));
    setup();
    const fixture = create();
    const trigger = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((button) => button.textContent?.includes('Créer mon premier établissement'))!;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const cancel = fixture.nativeElement.querySelector('app-establishment-form button[type="button"]') as HTMLButtonElement;
    cancel.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('empêche de fermer et de soumettre en double pendant la création puis conserve la modale en cas d’erreur', async () => {
    const response = new Subject<never>();
    establishments.create.and.returnValue(response);
    setup();
    const fixture = create();
    (fixture.nativeElement.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance['createEstablishment'](createRequest);
    fixture.componentInstance['createEstablishment'](createRequest);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(dialog.open).toBeTrue();
    expect(fixture.componentInstance['creationOpen']()).toBeTrue();
    expect((dialog.querySelector('[aria-label="Fermer la fenêtre"]') as HTMLButtonElement).disabled).toBeTrue();
    expect((dialog.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBeTrue();
    expect(establishments.create).toHaveBeenCalledTimes(1);
    response.error(new HttpErrorResponse({ status: 409 }));
    fixture.detectChanges();
    expect(dialog.querySelector('.form-error[role="alert"]')?.textContent).toContain('déjà utilisé');
    expect((dialog.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBeFalse();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('ne propose pas de modale sans permission de création', () => {
    setup(['can_establishment_read']);
    const fixture = create();
    expect(fixture.nativeElement.querySelector('[aria-haspopup="dialog"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-establishment-form')).toBeNull();
  });

  it('ferme la modale de licence avec Échap et permet de reprendre depuis le portail', async () => {
    licenses.list.and.returnValue(of([]));
    setup();
    const fixture = create();
    const trigger = fixture.nativeElement.querySelector('app-establishment-card button[aria-haspopup="dialog"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBeTrue();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(text(fixture)).toContain('Reprendre l’enregistrement');
    expect(licenses.assign).not.toHaveBeenCalled();
  });

  it('bloque la fermeture de la licence pendant l’enregistrement et conserve les choix en cas d’échec', async () => {
    const response = new Subject<never>();
    licenses.list.and.returnValue(of([]));
    licenses.assign.and.returnValue(response);
    setup();
    const fixture = create();
    fixture.componentInstance['startLicenseRegistration'](establishment);
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const form = dialog.querySelector('form')!;
    const select = form.querySelector('select')!;
    select.value = offer.id;
    select.dispatchEvent(new Event('change'));
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(dialog.open).toBeTrue();
    expect(fixture.componentInstance['licenseTarget']()).toEqual(establishment);
    expect((dialog.querySelector('[aria-label="Fermer la fenêtre"]') as HTMLButtonElement).disabled).toBeTrue();
    expect((form.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBeTrue();
    response.error(new HttpErrorResponse({ status: 409 }));
    fixture.detectChanges();
    expect(form.querySelector('[role="alert"]')?.textContent).toContain('conflit');
    expect(select.value).toBe(offer.id);
    expect((dialog.querySelector('[aria-label="Fermer la fenêtre"]') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('revient au portail à la fermeture d’un ancien lien d’enregistrement', async () => {
    setup(all, true);
    const fixture = create();
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('[aria-label="Fermer la fenêtre"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/establishments'], { replaceUrl: true });
  });

  it('affiche uniquement l’établissement en lecture seule, sans liste ni sélecteur d’établissement', () => {
    setup(all, true);
    const fixture = create();
    expect(text(fixture)).toContain(establishment.name);
    expect(text(fixture)).toContain(establishment.code);
    expect(fixture.nativeElement.querySelector('app-establishment-license-form')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-establishment-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Liste des établissements"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('select').length).toBe(1);
    expect(establishments.getAccessible).not.toHaveBeenCalled();
    expect(text(fixture)).not.toMatch(/Ignorer|Plus tard|sans licence/i);
  });

  for (const id of [null, 'invalid']) {
    it(`bloque un identifiant ${id === null ? 'absent' : 'invalide'} sans charger de liste ni permettre l’enregistrement`, () => {
      setup(all, true, id);
      const fixture = create();
      expect(text(fixture)).toContain('absent ou invalide');
      expect(fixture.nativeElement.querySelector('form')).toBeNull();
      expect(establishments.getAccessible).not.toHaveBeenCalled();
      expect(licenses.assign).not.toHaveBeenCalled();
    });
  }

  it('retrouve l’établissement depuis l’URL sans contexte de navigation après rechargement', () => {
    setup(all, true, establishment.id, null);
    const fixture = create();
    expect(establishments.getAccessible).toHaveBeenCalledTimes(1);
    expect(text(fixture)).toContain(establishment.name);
    expect(fixture.nativeElement.querySelector('app-establishment-card')).toBeNull();
  });

  it('refuse un établissement absent des établissements accessibles', () => {
    establishments.getAccessible.and.returnValue(of([second]));
    setup(all, true, establishment.id, { establishment: second });
    const fixture = create();
    expect(text(fixture)).toContain('absent ou inaccessible');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('ne charge pas les établissements sans droit de lecture et sans contexte', () => {
    setup(['can_license_assign', 'can_license_offer_read'], true, establishment.id, {});
    const fixture = create();
    expect(text(fixture)).toContain('contexte de l’établissement est indisponible');
    expect(establishments.getAccessible).not.toHaveBeenCalled();
  });

  it('conserve le parcours de création sans permission de lecture des établissements ou licences', () => {
    setup(['can_establishment_onboard', 'can_license_assign', 'can_license_offer_read'], true);
    const fixture = create();
    expect(fixture.nativeElement.querySelector('form')).toBeTruthy();
    expect(establishments.getAccessible).not.toHaveBeenCalled();
    expect(licenses.list).not.toHaveBeenCalled();
  });

  it('bloque aussi un identifiant invalide lors d’un appel direct du formulaire', () => {
    setup(all, true);
    const fixture = create();
    fixture.componentInstance['licenseTarget'].set({ ...establishment, id: 'invalid' });
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(EstablishmentLicenseFormComponent)).componentInstance as EstablishmentLicenseFormComponent;
    form['offerId'] = offer.id;
    form['register']();
    expect(form['error']()).toContain('absent ou invalide');
    expect(licenses.assign).not.toHaveBeenCalled();
  });

  it('ne permet pas de soumettre une offre absente du catalogue disponible', () => {
    setup(all, true);
    const fixture = create();
    const form = fixture.debugElement.query(By.directive(EstablishmentLicenseFormComponent)).componentInstance as EstablishmentLicenseFormComponent;
    form['offerId'] = 'unknown';
    form['register']();
    expect(licenses.assign).not.toHaveBeenCalled();
  });

  it('refuse l’enregistrement sans les permissions nécessaires', () => {
    setup(['can_establishment_onboard'], true);
    const fixture = create();
    const form = fixture.debugElement.query(By.directive(EstablishmentLicenseFormComponent)).componentInstance as EstablishmentLicenseFormComponent;
    form['offerId'] = offer.id;
    form['register']();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(licenses.offers).not.toHaveBeenCalled();
    expect(licenses.assign).not.toHaveBeenCalled();
  });

  for (const period of [
    { from: 'invalid', until: '' },
    { from: '', until: '2000-01-01T12:00' },
    { from: '2099-02-01T12:00', until: '2099-01-01T12:00' }
  ]) {
    it(`bloque une période invalide ${period.from} / ${period.until}`, () => {
      setup(all, true);
      const fixture = create();
      const form = fixture.debugElement.query(By.directive(EstablishmentLicenseFormComponent)).componentInstance as EstablishmentLicenseFormComponent;
      form['offerId'] = offer.id;
      form['validFrom'] = period.from;
      form['validUntil'] = period.until;
      form['register']();
      expect(form['error']()).toContain('période');
      expect(licenses.assign).not.toHaveBeenCalled();
    });
  }

  it('redirige vers le portail de l’établissement après l’enregistrement de la licence', async () => {
    licenses.list.and.returnValue(of([]));
    setup(all, true);
    const router = TestBed.inject(Router);
    const navigate = router.navigate as jasmine.Spy;
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('app-establishment-license-form form') as HTMLFormElement;
    const select = form.querySelector('select') as HTMLSelectElement;
    select.value = 'offer-1';
    select.dispatchEvent(new Event('change'));
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(licenses.assign).toHaveBeenCalledOnceWith(establishment.id, { offerId: 'offer-1' });
    expect(establishments.create).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/establishments', establishment.id], { state: { licenseRegistered: establishment.id } });
    expect(TestBed.inject(ToastService).notifications().map(item => item.message).join(' ')).toContain('a été enregistrée');
  });

  it('conserve les saisies et ne recrée pas l’établissement si la licence échoue', async () => {
    licenses.list.and.returnValue(of([]));
    licenses.assign.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    setup(all, true);
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('app-establishment-license-form form') as HTMLFormElement;
    const select = form.querySelector('select') as HTMLSelectElement;
    select.value = 'offer-1';
    select.dispatchEvent(new Event('change'));
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-establishment-license-form [role="alert"]')?.textContent).toContain('réessayer');
    expect((fixture.nativeElement.querySelector('app-establishment-license-form select') as HTMLSelectElement).value).toBe('offer-1');
    expect(establishments.create).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('n’enregistre pas de licence en double si une licence existe déjà', async () => {
    setup(all, true);
    const fixture = create();
    fixture.componentInstance['licenseTarget'].set(establishment);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('app-establishment-license-form form') as HTMLFormElement;
    const select = form.querySelector('select') as HTMLSelectElement;
    select.value = 'offer-1';
    select.dispatchEvent(new Event('change'));
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(licenses.assign).not.toHaveBeenCalled();
  });

  it('désactive un établissement après confirmation', () => {
    setup();
    spyOn(TestBed.inject(ConfirmationDialogService), 'confirm').and.callFake((_message, accept) => accept());
    const fixture = create();
    fixture.componentInstance['deactivateEstablishment'](establishment);
    expect(establishments.deactivate).toHaveBeenCalledOnceWith(establishment.id);
  });
});
