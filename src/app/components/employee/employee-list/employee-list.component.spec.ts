import { ToastService } from '../../../service/toast-service/toast.service';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { By } from '@angular/platform-browser';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { EmployeeFormComponent } from '../employee-form/employee-form.component';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../../../environments/environment';
import { EmployeeListComponent } from './employee-list.component';
import { EmployeeWorkspaceComponent } from '../employee-workspace/employee-workspace.component';

describe('EmployeeListComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [providePermissionFixture(['can_employee_read', 'can_employee_create', 'can_employee_update', 'can_employee_assign_roles', 'can_employee_assign_administrator', 'can_employee_delete', 'can_position_read'], ['school', 'school-1', 'other-school']),
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{
          path: 'establishments/:establishmentId/team',
          component: EmployeeWorkspaceComponent,
          children: [{ path: 'employees', component: EmployeeListComponent }]
        }])
      ]
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('filters employees to the establishment in the nested team route', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/establishments/school-1/team/employees', EmployeeWorkspaceComponent);

    httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/employees`).flush([
      {
        id: 'employee-1', employeeNumber: 'EMP-001', firstName: 'Ada', lastName: 'Lovelace',
        email: 'ada@example.test', positionId: 'position-1', positionName: 'Enseignante',
        enabled: true, establishmentAdmin: false, directRoleCodes: ['STAFF'], roles: ['STAFF'],
        establishmentId: 'school-1', loginEnabled: true,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
      },
      {
        id: 'employee-2', employeeNumber: 'EMP-002', firstName: 'Grace', lastName: 'Hopper',
        email: 'grace@example.test', positionId: 'position-2', positionName: 'Enseignante',
        enabled: true, establishmentAdmin: false, directRoleCodes: ['STAFF'], roles: ['STAFF'],
        establishmentId: 'school-2', loginEnabled: true,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
      }
    ]);
    httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/positions`).flush([]);

    harness.detectChanges();
    const content = harness.routeNativeElement?.textContent ?? '';
    expect(content).toContain('Ada Lovelace');
    expect(content).not.toContain('Grace Hopper');
    expect(content).toContain('Inviter un membre du personnel');
  });

  async function openInvitation() {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/establishments/school-1/team/employees', EmployeeWorkspaceComponent);
    httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/employees`).flush([]);
    httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/positions`).flush([
      { id: 'position-1', establishmentId: 'school-1', name: 'Enseignante', enabled: true, roleCodes: ['STAFF'] }
    ]);
    harness.detectChanges();
    const trigger = harness.routeNativeElement!.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement;
    expect(harness.routeNativeElement!.querySelector('app-employee-form')).toBeNull();
    trigger.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const dialog = harness.routeNativeElement!.querySelector('dialog') as HTMLDialogElement;
    return { harness, trigger, dialog };
  }

  it('ouvre le formulaire en modale et rend le focus après Échap', async () => {
    const { harness, trigger, dialog } = await openInvitation();
    expect(dialog.open).toBeTrue();
    expect(dialog.querySelector('app-employee-form')).toBeTruthy();
    expect(document.activeElement?.getAttribute('name')).toBe('firstName');
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('bloque la fermeture pendant l’envoi et ferme après succès en rechargeant la liste', async () => {
    const { harness, dialog } = await openInvitation();
    const child = harness.fixture.debugElement.query(By.directive(EmployeeFormComponent)).componentInstance as EmployeeFormComponent;
    child['firstName'] = 'Ada';
    child['lastName'] = 'Lovelace';
    child['email'] = 'ada@example.test';
    child['employeeNumber'] = 'EMP-001';
    child['positionId'] = 'position-1';
    child['save']();
    harness.detectChanges();
    const request = httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/employees`);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    harness.detectChanges();
    expect(dialog.open).toBeTrue();
    expect((dialog.querySelector('[aria-label="Fermer la fenêtre"]') as HTMLButtonElement).disabled).toBeTrue();
    request.flush({ employeeId: 'employee-1', status: 'INVITATION_SENT' });
    httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/employees`).flush([]);
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('dialog')).toBeNull();
    expect(TestBed.inject(ToastService).notifications().map(item => item.message).join(' ')).toContain('Invitation envoyée à ada@example.test');
  });

  it('permet d’annuler sans envoyer de requête de création', async () => {
    const { harness, dialog } = await openInvitation();
    (dialog.querySelector('footer button[type="button"]') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('dialog')).toBeNull();
    httpTesting.expectNone(request => request.method === 'POST');
  });

  it('ne propose pas le formulaire sans permission de création', async () => {
    const access = TestBed.inject(WorkspaceAccessService);
    spyOn(access, 'hasPermission').and.callFake(permission => permission === 'can_employee_read' || permission === 'can_position_read');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/establishments/school-1/team/employees', EmployeeWorkspaceComponent);
    httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/employees`).flush([]);
    httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/positions`).flush([]);
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('[aria-haspopup="dialog"]')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('app-employee-form')).toBeNull();
  });


  async function openEdit() {
    const employee = { id: 'employee-1', establishmentId: 'school-1', employeeNumber: 'EMP-001', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', positionId: 'position-1', positionName: 'Enseignante', enabled: true, loginEnabled: true, establishmentAdmin: false, directRoleCodes: ['STAFF'], roles: ['STAFF'], createdAt: '', updatedAt: '' };
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/establishments/school-1/team/employees', EmployeeWorkspaceComponent);
    httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/employees`).flush([employee]);
    httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/positions`).flush([
      { id: 'position-1', establishmentId: 'school-1', name: 'Enseignante', enabled: true, roleCodes: ['STAFF'] }
    ]);
    harness.detectChanges();
    const trigger = harness.routeNativeElement!.querySelector<HTMLButtonElement>('app-table-actions > button')!;
    trigger.click(); harness.detectChanges();
    Array.from(harness.routeNativeElement!.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Modifier')!.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const dialog = harness.routeNativeElement!.querySelector('dialog') as HTMLDialogElement;
    return { harness, dialog, trigger, employee };
  }

  it('ouvre une modale de modification préremplie et permet de fermer avec Échap', async () => {
    const { harness, dialog, trigger } = await openEdit();
    expect(dialog.open).toBeTrue();
    expect(dialog.textContent).toContain('Modifier un membre du personnel');
    expect((dialog.querySelector('[name="firstName"]') as HTMLInputElement).value).toBe('Ada');
    expect(harness.routeNativeElement!.querySelector('tbody form.form-edit')).toBeNull();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    httpTesting.expectNone(request => request.method === 'PATCH');
  });

  it('empêche de fermer pendant la modification puis ferme et recharge la liste après succès', async () => {
    const { harness, dialog, employee } = await openEdit();
    const email = dialog.querySelector('[name="email"]') as HTMLInputElement;
    email.value = 'ada.updated@example.test';
    email.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    dialog.querySelector('form')!.dispatchEvent(new Event('submit'));
    harness.detectChanges();
    const request = httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/employees/employee-1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.email).toBe(email.value);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    harness.detectChanges();
    expect(dialog.open).toBeTrue();
    expect((dialog.querySelector('[aria-label="Fermer la fenêtre"]') as HTMLButtonElement).disabled).toBeTrue();
    dialog.querySelector('form')!.dispatchEvent(new Event('submit'));
    httpTesting.expectNone(request => request.method === 'PATCH');
    request.flush({ ...employee, email: email.value });
    httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/employees`).flush([{ ...employee, email: email.value }]);
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('dialog')).toBeNull();
    expect(TestBed.inject(ToastService).notifications().map(item => item.message).join(' ')).toContain('a été mise à jour');
    expect(harness.routeNativeElement!.textContent).toContain(email.value);
  });

  it('affiche les erreurs de modification dans la modale et conserve la saisie', async () => {
    const { harness, dialog } = await openEdit();
    const email = dialog.querySelector('[name="email"]') as HTMLInputElement;
    email.value = 'nouvelle@example.test';
    email.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    dialog.querySelector('form')!.dispatchEvent(new Event('submit'));
    httpTesting.expectOne(`${environment.apiUrl}/establishments/school-1/employees/employee-1`).flush({}, { status: 409, statusText: 'Conflict' });
    harness.detectChanges();
    expect(dialog.open).toBeTrue();
    expect(dialog.querySelector('.form-error')?.textContent).toContain('déjà cet e-mail');
    expect(email.value).toBe('nouvelle@example.test');
    expect((dialog.querySelector('[aria-label="Fermer la fenêtre"]') as HTMLButtonElement).disabled).toBeFalse();
  });

});
