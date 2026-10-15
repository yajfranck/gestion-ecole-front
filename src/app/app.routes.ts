import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { AuthenticatedLayoutComponent } from './shared/layout/authenticated-layout.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { EstablishmentsComponent } from './components/establishment/establishment-list/establishment-list.component';
import { EstablishmentWorkspaceComponent } from './components/establishment/establishment-workspace/establishment-workspace.component';
import { AcademicYearWorkspaceComponent } from './components/academic-year/academic-year-workspace/academic-year-workspace.component';
import { LoginComponent } from './components/auth/login/login.component';
import { EmployeeWorkspaceComponent } from './components/employee/employee-workspace/employee-workspace.component';
import { EmployeeListComponent } from './components/employee/employee-list/employee-list.component';
import { PositionsComponent } from './components/position/position-list/position-list.component';
import { RolesComponent } from './components/role/role-list/role-list.component';
import { PermissionsComponent } from './components/permission/permission-list/permission-list.component';
import { ChangePasswordComponent } from './components/auth/change-password/change-password.component';
import { AcceptInvitationComponent } from './components/auth/accept-invitation/accept-invitation.component';
import { EmployeeDetailComponent } from './components/employee/employee-detail/employee-detail.component';
import { GuardianChildrenComponent } from './components/guardian/guardian-children/guardian-children.component';

export const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	{ path: 'accept-invitation', component: AcceptInvitationComponent },
	{ path: 'accept-guardian-invitation', component: AcceptInvitationComponent, data: { invitationType: 'guardian' } },
	{
		path: '',
		component: AuthenticatedLayoutComponent,
		canActivate: [authGuard],
		canActivateChild: [authGuard],
		children: [
			{ path: 'dashboard', component: DashboardComponent },
			{ path: 'account/password', component: ChangePasswordComponent },
			{ path: 'account/profile', component: EmployeeDetailComponent, data: { self: true } },
			{ path: 'parent/children', component: GuardianChildrenComponent },
			{ path: 'establishments', component: EstablishmentsComponent },
			{
				path: 'establishments/:establishmentId/employees',
				redirectTo: 'establishments/:establishmentId/team/employees',
				pathMatch: 'full'
			},
			{
				path: 'establishments/:establishmentId/team',
				component: EmployeeWorkspaceComponent,
				children: [
					{ path: 'employees', component: EmployeeListComponent },
					{ path: 'employees/:employeeId', component: EmployeeDetailComponent },
					{ path: 'positions', component: PositionsComponent },
					{ path: 'roles', component: RolesComponent },
					{ path: 'permissions', component: PermissionsComponent },
					{ path: '', redirectTo: 'employees', pathMatch: 'full' }
				]
			},
			{
				path: 'establishments/:establishmentId/school-years/:academicYearId',
				component: AcademicYearWorkspaceComponent
			},
			{ path: 'establishments/:establishmentId', component: EstablishmentWorkspaceComponent },
			{ path: '', redirectTo: 'dashboard', pathMatch: 'full' }
		]
	},
	{ path: '**', redirectTo: 'dashboard' }
];
