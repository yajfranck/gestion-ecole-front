import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { Employee } from '../../../models/employee/employee.model';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { EmployeeFormComponent } from './employee-form.component';

describe('EmployeeFormComponent', () => {
  const position = { id: 'position-1', establishmentId: 'school-1', name: 'Enseignante', enabled: true, roleCodes: ['STAFF'], createdAt: '', updatedAt: '' };
  const employee: Employee = { id: 'employee-1', establishmentId: 'school-1', employeeNumber: 'EMP-001', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', positionId: position.id, positionName: position.name, enabled: true, loginEnabled: true, establishmentAdmin: false, directRoleCodes: ['STAFF'], roles: ['STAFF'], createdAt: '', updatedAt: '' };
  const values = { firstName: ' Ada ', lastName: ' Lovelace ', email: 'ada@example.test', employeeNumber: ' EMP-001 ', positionId: position.id };
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EmployeeFormComponent],
      providers: [providePermissionFixture(['can_employee_create', 'can_employee_update'], ['school-1']), provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function create(employee: Employee | null = null) {
    const fixture = TestBed.createComponent(EmployeeFormComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('employee', employee);
    fixture.componentRef.setInput('positions', [position]);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  async function fill(fixture: Awaited<ReturnType<typeof create>>, fields = values) {
    for (const [name, value] of Object.entries(fields)) {
      const input = fixture.nativeElement.querySelector(`[name="${name}"]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event(name === 'positionId' ? 'change' : 'input'));
    }
    await fixture.whenStable();
  }

  it('envoie une invitation, nettoie les saisies et communique l’état occupé', async () => {
    const fixture = await create();
    const busy = jasmine.createSpy('busy');
    const invited = jasmine.createSpy('invited');
    fixture.componentInstance.busyChange.subscribe(busy);
    fixture.componentInstance.invited.subscribe(invited);
    await fill(fixture);
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    const request = http.expectOne(`${environment.apiUrl}/establishments/school-1/employees`);
    expect(request.request.body).toEqual({ firstName: 'Ada', lastName: 'Lovelace', email: values.email, employeeNumber: 'EMP-001', positionId: position.id });
    expect(busy).toHaveBeenCalledOnceWith(true);
    expect((fixture.nativeElement.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBeTrue();
    fixture.componentInstance['save']();
    http.expectNone(`${environment.apiUrl}/establishments/school-1/employees`);
    request.flush({ employeeId: 'employee-1', status: 'INVITATION_SENT' });
    expect(invited).toHaveBeenCalledOnceWith(values.email);
    expect(busy.calls.allArgs()).toEqual([[true], [false]]);
  });

  for (const invalid of [{ ...values, email: 'invalide' }, { ...values, firstName: '   ' }]) {
    it('refuse les champs invalides sans envoyer d’invitation', async () => {
      const fixture = await create();
      await fill(fixture, invalid);
      fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[aria-invalid="true"]')).toBeTruthy();
      http.expectNone(`${environment.apiUrl}/establishments/school-1/employees`);
    });
  }

  it('conserve les saisies après une erreur d’envoi', async () => {
    const fixture = await create();
    await fill(fixture);
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    http.expectOne(`${environment.apiUrl}/establishments/school-1/employees`).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.form-error')?.textContent).toContain('courriel est indisponible');
    expect((fixture.nativeElement.querySelector('[name="email"]') as HTMLInputElement).value).toBe(values.email);
    expect(fixture.componentInstance['isSaving']()).toBeFalse();
  });

  it('empêche l’envoi sans poste actif disponible', async () => {
    const fixture = await create();
    fixture.componentRef.setInput('positions', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Créez d’abord un poste actif');
    expect((fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBeTrue();
    http.expectNone(`${environment.apiUrl}/establishments/school-1/employees`);
  });

  it('préremplit la modification et enregistre l’identité sans réaffecter un poste indisponible', async () => {
    const fixture = await create(employee);
    const saved = jasmine.createSpy('saved');
    const invited = jasmine.createSpy('invited');
    fixture.componentInstance.saved.subscribe(saved);
    fixture.componentInstance.invited.subscribe(invited);
    expect((fixture.nativeElement.querySelector('[name="firstName"]') as HTMLInputElement).value).toBe(employee.firstName);
    fixture.componentRef.setInput('positions', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('poste actuel');
    await fill(fixture, { ...values, email: 'ada.updated@example.test' });
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    const request = http.expectOne(`${environment.apiUrl}/establishments/school-1/employees/employee-1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ employeeNumber: 'EMP-001', firstName: 'Ada', lastName: 'Lovelace', email: 'ada.updated@example.test' });
    request.flush({ ...employee, email: 'ada.updated@example.test' });
    expect(saved).toHaveBeenCalledTimes(1);
    expect(invited).not.toHaveBeenCalled();
  });

  it('permet d’affecter un autre poste actif du même établissement', async () => {
    const fixture = await create(employee);
    fixture.componentRef.setInput('positions', [position, { ...position, id: 'position-2', name: 'Direction' }]);
    fixture.detectChanges();
    await fill(fixture, { ...values, positionId: 'position-2' });
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    const request = http.expectOne(`${environment.apiUrl}/establishments/school-1/employees/employee-1`);
    expect(request.request.body.positionId).toBe('position-2');
    request.flush({ ...employee, positionId: 'position-2' });
  });

  it('conserve les modifications saisies après un conflit', async () => {
    const fixture = await create(employee);
    await fill(fixture, { ...values, email: 'nouvelle@example.test' });
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    http.expectOne(`${environment.apiUrl}/establishments/school-1/employees/employee-1`).flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.form-error')?.textContent).toContain('déjà cet e-mail');
    expect((fixture.nativeElement.querySelector('[name="email"]') as HTMLInputElement).value).toBe('nouvelle@example.test');
    expect(fixture.componentInstance['isSaving']()).toBeFalse();
  });

  it('refuse la modification sans la permission correspondante', async () => {
    spyOn(TestBed.inject(WorkspaceAccessService), 'hasPermission').and.returnValue(false);
    const fixture = await create(employee);
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    fixture.componentInstance['save']();
    http.expectNone(request => request.method === 'PATCH');
  });

});
