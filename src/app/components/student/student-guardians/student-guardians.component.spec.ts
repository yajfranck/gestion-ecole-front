import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { StudentGuardiansComponent } from './student-guardians.component';

const student = { id: 'student-1', establishmentId: 'school-1', studentNumber: 'STU-1', firstName: 'Ada', lastName: 'Lovelace', enabled: true };
const guardian = { id: 'g-1', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org' };
const other = { id: 'g-2', firstName: 'Marie', lastName: 'Diallo', email: 'marie@example.org' };

describe('StudentGuardiansComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/students/student-1`;
  let http: HttpTestingController;
  let fixture: ComponentFixture<StudentGuardiansComponent>;
  let element: HTMLElement;
  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [StudentGuardiansComponent], providers: [providePermissionFixture(['can_student_read', 'can_guardian_read', 'can_guardian_link', 'can_guardian_unlink']), provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentGuardiansComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1'); fixture.componentRef.setInput('studentId', 'student-1'); fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges(); http.expectOne(url).flush(student); http.expectOne(`${url}/guardians`).flush([]); fixture.detectChanges(); await fixture.whenStable();
    element = fixture.nativeElement;
  });
  afterEach(() => http.verify());
  async function fill(firstName = 'Grace', lastName = 'Hopper', email = 'grace@example.org') {
    const inputs = [...element.querySelectorAll<HTMLInputElement>('input:not([readonly])')].slice(-3);
    [firstName, lastName, email].forEach((value, index) => { inputs[index].value = value; inputs[index].dispatchEvent(new Event('input', { bubbles: true })); });
    fixture.detectChanges(); await fixture.whenStable();
  }
  function submit() { fixture.componentInstance.saveAndContinue(); fixture.detectChanges(); }

  it('affiche les champs utiles dans une grille commune sans titre supplémentaire', () => {
    expect(element.querySelector('app-guardian-form h3')).toBeNull();
    expect(element.textContent).toContain('Ajouter un tuteur');
    expect(element.textContent).not.toContain('Lier un tuteur');
    expect(element.textContent).not.toContain('Toute personne');
    expect(element.querySelectorAll('input').length).toBe(3);
    expect(element.querySelector('button[aria-label="Supprimer le tuteur 1"] svg')).not.toBeNull();
  });
  it('normalise les champs et utilise la réponse sans nouvelle lecture API', async () => {
    await fill(' Grace ', ' Hopper ', ' GRACE@EXAMPLE.ORG '); submit();
    const call = http.expectOne(`${url}/guardians`);
    expect(call.request.body).toEqual({ firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org' });
    expect(element.querySelector('fieldset')!.disabled).toBeTrue();
    call.flush({ guardian, accessStatus: 'INVITATION_SENT' }); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.componentInstance.snapshots()).toEqual([]);
    expect([...element.querySelectorAll<HTMLInputElement>('input')].map(input => input.value)).toEqual(['Grace', 'Hopper', 'grace@example.org']);
    expect([...element.querySelectorAll<HTMLInputElement>('input')].every(input => input.readOnly)).toBeTrue();
    submit(); http.expectNone(() => true);
  });
  it('conserve l’identité renvoyée pour un compte existant sans prétendre la modifier', async () => {
    await fill('Autre prénom', 'Autre nom'); submit();
    http.expectOne(`${url}/guardians`).flush({ guardian, accessStatus: 'ACCESS_ALREADY_ACTIVE' }); fixture.detectChanges(); await fixture.whenStable();
    expect(element.querySelector<HTMLInputElement>('input')!.value).toBe('Grace');
    expect(element.querySelector('button[aria-label^="Modifier"]')).toBeNull();
    http.expectNone(request => request.method === 'PATCH' || request.method === 'GET');
  });
  for (const [label, firstName, lastName, email] of [
    ['un prénom vide', '', 'Hopper', 'grace@example.org'],
    ['un nom blanc', 'Grace', '   ', 'grace@example.org'],
    ['un prénom trop long', 'G'.repeat(101), 'Hopper', 'grace@example.org'],
    ['un nom trop long', 'Grace', 'H'.repeat(101), 'grace@example.org'],
    ['un e-mail invalide', 'Grace', 'Hopper', 'adresse-invalide'],
    ['un e-mail trop long', 'Grace', 'Hopper', 'a'.repeat(255)]
  ]) {
    it(`refuse ${label} sans appeler l’API`, async () => { await fill(firstName, lastName, email); submit(); http.expectNone(request => request.method === 'POST'); expect(element.querySelector('[role="alert"]')!.textContent).toContain('Vérifiez le prénom'); });
  }
  it('bloque les doubles envois et conserve la ligne en cas de refus', async () => {
    await fill(); submit(); const call = http.expectOne(`${url}/guardians`); submit(); http.expectNone(request => request.method === 'POST');
    call.flush({}, { status: 409, statusText: 'Conflict' }); fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')!.textContent).toContain('en conflit avec une autre identité');
    expect(fixture.componentInstance.snapshot().email).toBe('grace@example.org');
    submit(); http.expectOne(`${url}/guardians`).flush({ guardian, accessStatus: 'ACCESS_ALREADY_ACTIVE' }); fixture.detectChanges(); http.expectNone(request => request.method === 'GET');
  });
  it('conserve les réussites partielles et ne renvoie que les lignes restantes après une erreur', async () => {
    await fill(); [...element.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Ajouter un tuteur')!.click(); fixture.detectChanges(); await fixture.whenStable();
    await fill('Marie', 'Diallo', 'marie@example.org');
    const continued = jasmine.createSpy('continued'); fixture.componentInstance.continued.subscribe(continued);
    submit(); http.expectOne(`${url}/guardians`).flush({ guardian, accessStatus: 'INVITATION_SENT' });
    const second = http.expectOne(`${url}/guardians`); expect(second.request.body.email).toBe('marie@example.org'); second.flush({}, { status: 503, statusText: 'Unavailable' }); fixture.detectChanges(); await fixture.whenStable();
    expect(continued).not.toHaveBeenCalled(); expect(fixture.componentInstance.snapshots()).toEqual([{ firstName: 'Marie', lastName: 'Diallo', email: 'marie@example.org' }]);
    expect(fixture.componentInstance['guardians']()).toEqual([guardian]);
    submit(); const retry = http.expectOne(`${url}/guardians`); expect(retry.request.body.email).toBe('marie@example.org'); retry.flush({ guardian: other, accessStatus: 'INVITATION_SENT' }); fixture.detectChanges();
    expect(continued).toHaveBeenCalledTimes(1); expect(fixture.componentInstance.snapshots()).toEqual([]); http.expectNone(() => true);
  });
});
