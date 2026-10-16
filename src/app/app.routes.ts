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
import { EstablishmentSettingsComponent } from './components/establishment/establishment-settings/establishment-settings.component';
import { EstablishmentReferentialsComponent } from './components/establishment/establishment-referentials/establishment-referentials.component';
import { StudentListComponent } from './components/student/student-list/student-list.component';
import { EnrollmentWorkspaceComponent } from './components/enrollment/enrollment-workspace/enrollment-workspace.component';
import { AcademicYearClassesComponent } from './components/academic-year/academic-year-classes/academic-year-classes.component';
import { AcademicYearCalendarComponent } from './components/academic-year/academic-year-calendar/academic-year-calendar.component';
import { AcademicYearFinanceComponent } from './components/academic-year/academic-year-finance/academic-year-finance.component';
import { EmployeeDetailComponent } from './components/employee/employee-detail/employee-detail.component';
import { GuardianChildrenComponent } from './components/guardian/guardian-children/guardian-children.component';
import { AttendanceSheetComponent } from './components/attendance/attendance-sheet/attendance-sheet.component';
import { AttendanceHistoryComponent } from './components/attendance/attendance-history/attendance-history.component';
import { pendingChangesGuard } from './shared/pending-changes.service';

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
				path: 'establishments/:establishmentId',
				component: EstablishmentWorkspaceComponent,
				children: [
					{ path: '', component: EstablishmentSettingsComponent, pathMatch: 'full' },
					{
						path: 'team',
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
					{ path: 'students', component: StudentListComponent },
					{ path: 'referentials', component: EstablishmentReferentialsComponent },
					{
						path: 'school-years/:academicYearId',
						component: AcademicYearWorkspaceComponent,
						children: [
														{ path: 'classes', component: AcademicYearClassesComponent },
														{ path: 'attendance', component: AttendanceSheetComponent, canDeactivate: [pendingChangesGuard], runGuardsAndResolvers: 'always' },
														{ path: 'attendance/history/:studentId', component: AttendanceHistoryComponent },
							{ path: 'enrollments', component: EnrollmentWorkspaceComponent },
							{ path: 'calendar', component: AcademicYearCalendarComponent },
							{ path: 'finance', component: AcademicYearFinanceComponent },
							{ path: '', redirectTo: 'classes', pathMatch: 'full' }
						]
					}
				]
			},
			{ path: '', redirectTo: 'dashboard', pathMatch: 'full' }
		]
	},
	{ path: '**', redirectTo: 'dashboard' }
];
