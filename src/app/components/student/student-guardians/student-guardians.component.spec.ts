import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { StudentGuardiansComponent } from './student-guardians.component';

describe('StudentGuardiansComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/students/student-1`;
  const student = { id: 'student-1', establishmentId: 'school-1', studentNumber: 'STU-00000001', firstName: 'Ada', lastName: 'Lovelace', enabled: true };
  const guardian = { id: 'g-1', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org' };
  let http: HttpTestingController;
  let fixture: ComponentFixture<StudentGuardiansComponent>;
  let element: HTMLElement;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [StudentGuardiansComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
  }));

  beforeEach(async () => {
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StudentGuardiansComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('studentId', 'student-1');
    fixture.detectChanges();
    http.expectOne(url).flush(student);
    http.expectOne(`${url}/guardians`).flush([guardian]);
    fixture.detectChanges();
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => http.verify());

  async function fillForm(firstName = 'Grace', lastName = 'Hopper', email = 'grace@example.org'): Promise<void> {
    const inputs = element.querySelectorAll('input');
    [firstName, lastName, email].forEach((value, index) => {
      inputs[index].value = value;
      inputs[index].dispatchEvent(new Event('input'));
      inputs[index].dispatchEvent(new Event('blur'));
    });
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function submit(): void {
    element.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  function finishLink(): void {
    http.expectOne(url).flush(student);
    http.expectOne(`${url}/guardians`).flush([guardian]);
    fixture.detectChanges();
  }

  it('affiche la fiche de l’élève, ses tuteurs et la possibilité de réutiliser un compte du personnel', () => {
    expect(element.textContent).toContain('STU-00000001');
    expect(element.textContent).toContain('Grace Hopper');
    expect(element.textContent).toContain('y compris un membre du personnel ou un administrateur');
  });

  it('normalise la saisie et confirme une invitation pour un nouveau compte', async () => {
    await fillForm(' Grace ', ' Hopper ', ' GRACE@EXAMPLE.ORG ');
    submit();

    const request = http.expectOne(`${url}/guardians`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org' });
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBeTrue();
    request.flush({ guardian, accessStatus: 'INVITATION_SENT' }, { status: 201, statusText: 'Created' });
    finishLink();
    await fixture.whenStable();

    expect(element.querySelector('output')!.textContent).toContain('Une invitation a été envoyée à grace@example.org');
    expect(Array.from(element.querySelectorAll('input')).every((input) => input.value === '')).toBeTrue();
    submit();
    http.expectNone((request) => request.method === 'POST');
  });

  it('confirme la réutilisation du compte sans invitation et conserve l’identité renvoyée par le serveur', async () => {
    await fillForm('Autre prénom', 'Autre nom');
    submit();
    http.expectOne(`${url}/guardians`).flush({ guardian, accessStatus: 'ACCESS_ALREADY_ACTIVE' }, { status: 201, statusText: 'Created' });
    finishLink();

    const message = element.querySelector('output')!.textContent;
    expect(message).toContain('compte existant de grace@example.org, sans nouvelle invitation');
    expect(message).toContain('Ses rôles et son mot de passe sont conservés');
    expect(message).toContain('se reconnecter');
    expect(element.querySelector('li')!.textContent).toContain('Grace Hopper');
  });

  for (const [label, firstName, lastName, email] of [
    ['un prénom vide', '', 'Hopper', 'grace@example.org'],
    ['un nom composé uniquement d’espaces', 'Grace', '   ', 'grace@example.org'],
    ['un prénom trop long', 'G'.repeat(101), 'Hopper', 'grace@example.org'],
    ['un nom trop long', 'Grace', 'H'.repeat(101), 'grace@example.org'],
    ['un e-mail invalide', 'Grace', 'Hopper', 'adresse-invalide'],
    ['un e-mail trop long', 'Grace', 'Hopper', `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(60)}.fr`]
  ]) {
    it(`refuse ${label} sans appeler l’API`, async () => {
      await fillForm(firstName, lastName, email);
      submit();

      http.expectNone((request) => request.method === 'POST');
      expect(element.querySelector('[role="alert"]')!.textContent).toContain('Vérifiez le prénom');
    });
  }

  it('bloque les doubles envois et conserve la saisie en cas de conflit d’identité', async () => {
    await fillForm();
    submit();
    const request = http.expectOne(`${url}/guardians`);
    submit();
    http.expectNone((pending) => pending.method === 'POST');
    request.flush(null, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain('en conflit avec une autre identité');
    expect(element.querySelector<HTMLInputElement>('input[type="email"]')!.value).toBe('grace@example.org');
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBeFalse();
    submit();
    http.expectOne(`${url}/guardians`).flush({ guardian, accessStatus: 'ACCESS_ALREADY_ACTIVE' });
    finishLink();
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('explique qu’un tuteur désactivé ou inaccessible ne peut pas être lié', async () => {
    await fillForm();
    submit();
    http.expectOne(`${url}/guardians`).flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')!.textContent).toContain('désactivé ou inaccessible');
  });
});
