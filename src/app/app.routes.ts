import { FEATURE_PERMISSIONS as features } from './core/feature-permissions';
import { Routes } from '@angular/router';
import { schoolYearOnboardingGuard } from './core/school-year-onboarding.guard';
import { SchoolYearOnboardingComponent } from './components/academic-year/school-year-onboarding/school-year-onboarding.component';
import { permissionGuard } from './core/permission.guard';
import { AccessDeniedComponent } from './components/auth/access-denied/access-denied.component';
import { authGuard } from './core/auth.guard';
import { AuthenticatedLayoutComponent } from './shared/layout/authenticated-layout.component';
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
import { GuardianChildDetailComponent } from './components/guardian/guardian-child-detail/guardian-child-detail.component';
import { LicenseWorkspaceComponent } from './components/license/license-workspace/license-workspace.component';
import { LearningWorkspaceComponent } from './components/learning/learning-workspace/learning-workspace.component';

export const routes: Routes = [
	{ path: 'login', component: LoginComponent },
	{ path: 'accept-invitation', component: AcceptInvitationComponent },
	{ path: 'accept-guardian-invitation', component: AcceptInvitationComponent, data: { invitationType: 'guardian' } },
	{
		path: '',
		component: AuthenticatedLayoutComponent,
		canActivate: [authGuard],
		canActivateChild: [authGuard, permissionGuard, schoolYearOnboardingGuard],
		children: [
            { path: 'setup/school-year', component: SchoolYearOnboardingComponent, data: { permissions: ['can_academic_year_create'], globalPermissions: true } },
			{ path: 'platform/permissions', component: PermissionsComponent, data: { global: true, globalPermissions: true, permissions: ['can_permission_read'] } },
			{ path: 'platform/roles', component: RolesComponent, data: { global: true, globalPermissions: true, platformPermissions: true, permissionRule: features.platformRoles } },
            { path: 'access-denied', component: AccessDeniedComponent },
			{ path: 'dashboard', redirectTo: 'establishments', pathMatch: 'full' },
			{ path: 'account/password', component: ChangePasswordComponent, data: { permissionRule: features.password } },
			{ path: 'account/profile', component: EmployeeDetailComponent, data: { self: true, permissions: ['can_employee_read_self'] } },
			{ path: 'parent/children', component: GuardianChildrenComponent, data: { permissions: ['can_guardian_read_children'] } },
			{ path: 'parent/children/:studentId', component: GuardianChildDetailComponent, data: { permissions: ['can_guardian_read_children'] } },
			{ path: 'parent/children/:studentId/school-years/:academicYearId/learning', component: LearningWorkspaceComponent, data: { permissions: ['can_guardian_read_children'] }, canDeactivate: [pendingChangesGuard] },
			{ path: 'establishments', component: EstablishmentsComponent, data: { permissionRule: features.establishments } },
			{ path: 'establishments/:establishmentId/license-registration', component: EstablishmentsComponent, data: { licenseRegistration: true, globalPermissions: true, permissionRule: { any: ['can_establishment_onboard', { all: ['can_license_assign', 'can_license_offer_read'] }] } } },
			{ path: 'establishments/:establishmentId/license', component: LicenseWorkspaceComponent, data: { permissionRule: features.license, globalPermissions: true } },
			{
				path: 'establishments/:establishmentId/employees',
				redirectTo: 'establishments/:establishmentId/team/employees',
				pathMatch: 'full'
			},
			{
				path: 'establishments/:establishmentId',
				component: EstablishmentWorkspaceComponent,
				children: [
					{ path: '', component: EstablishmentSettingsComponent, pathMatch: 'full', data: { permissionRule: features.settings } },
					{
						path: 'team',
						component: EmployeeWorkspaceComponent,
						children: [
							{ path: 'employees', component: EmployeeListComponent, data: { permissionRule: features.employees } },
							{ path: 'employees/:employeeId', component: EmployeeDetailComponent, data: { permissions: ['can_employee_read'] } },
							{ path: 'positions', component: PositionsComponent, data: { permissionRule: features.positions } },
							{ path: 'roles', component: RolesComponent, data: { permissionRule: features.roles } },
							{ path: 'permissions', component: PermissionsComponent, data: { permissions: ['can_permission_read'] } },
							{ path: '', redirectTo: 'employees', pathMatch: 'full' }
						]
					},
					{ path: 'students/:studentId/edit', component: StudentListComponent, data: { permissions: ['can_student_update'] } },
                    { path: 'students', component: StudentListComponent, data: { permissionRule: features.students } },
					{ path: 'referentials', component: EstablishmentReferentialsComponent, data: { permissionRule: features.subjects } },
					{
						path: 'school-years/:academicYearId',
						component: AcademicYearWorkspaceComponent,
                data: { permissions: ['can_academic_year_read'] },
						children: [
							{ path: 'learning', component: LearningWorkspaceComponent, data: { permissionRule: features.learning }, canDeactivate: [pendingChangesGuard], runGuardsAndResolvers: 'always' },
														{ path: 'classes', component: AcademicYearClassesComponent, data: { permissionRule: features.classes } },
														{ path: 'attendance', component: AttendanceSheetComponent, data: { permissionRule: features.attendance }, canDeactivate: [pendingChangesGuard], runGuardsAndResolvers: 'always' },
														{ path: 'attendance/history/:studentId', component: AttendanceHistoryComponent, data: { permissions: ['can_attendance_read'] } },
							{ path: 'enrollments', component: EnrollmentWorkspaceComponent, data: { permissionRule: features.enrollments }, canDeactivate: [pendingChangesGuard], runGuardsAndResolvers: 'always' },
							{ path: 'calendar', component: AcademicYearCalendarComponent, data: { permissionRule: features.calendar } },
							{ path: 'finance', component: AcademicYearFinanceComponent, data: { permissionRule: features.finance } },
							{ path: '', redirectTo: 'classes', pathMatch: 'full' }
						]
					}
				]
			},
			{ path: '', redirectTo: 'establishments', pathMatch: 'full' }
		]
	},
	{ path: '**', redirectTo: 'establishments' }
];
