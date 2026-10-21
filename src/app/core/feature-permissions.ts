import { PermissionRequirement } from './workspace-access.service';

// Accès aux fonctionnalités réellement utilisables. Les droits de mutation ne donnent
// jamais implicitement le droit de lire un catalogue ou une liste.
export const FEATURE_PERMISSIONS = {
  dashboard: 'can_dashboard_read',
  establishments: ['can_establishment_read', 'can_establishment_onboard'],
  settings: ['can_establishment_read', 'can_establishment_update', 'can_academic_year_read', 'can_academic_year_create'],
  students: ['can_student_read', 'can_student_create', 'can_student_update', 'can_student_delete'],
  employees: { any: ['can_employee_read', { all: ['can_employee_create', 'can_position_read'] }] },
  positions: ['can_position_read', 'can_position_create'],
  roles: { any: ['can_role_read', { all: ['can_role_create', 'can_permission_read'] }] },
  platformRoles: { any: ['can_platform_role_read', { all: ['can_platform_role_create', 'can_permission_read'] }] },
  permissions: 'can_permission_read',
  subjects: ['can_subject_read', 'can_subject_create'],
  classes: ['can_school_class_read', 'can_school_class_create'],
  enrollments: { any: ['can_enrollment_read', { all: ['can_enrollment_create', 'can_student_read', 'can_school_class_read'] }] },
  calendar: ['can_academic_period_read', 'can_academic_period_create', 'can_academic_year_update', 'can_academic_year_delete'],
  finance: { any: ['can_tuition_read', 'can_tuition_outstanding_read', 'can_tuition_fee_type_read', 'can_tuition_fee_type_create',
    { all: ['can_tuition_create', 'can_tuition_fee_type_read'] }] },
  attendance: { all: ['can_attendance_read', 'can_school_class_read'] },
  learning: { all: ['can_learning_content_read', 'can_school_class_read'] },
  timetable: { all: ['can_timetable_read', 'can_school_class_read'] },
  license: 'can_license_read',
  password: 'can_user_change_password'
} as const satisfies Record<string, PermissionRequirement>;

export interface PermissionNavItem {
  label: string;
  path: string[];
  permission: PermissionRequirement;
  exact?: boolean;
}

export const ESTABLISHMENT_NAVIGATION = [
  { label: 'Administration', items: [
    { label: 'Personnel', permission: FEATURE_PERMISSIONS.employees, path: ['team', 'employees'] },
    { label: 'Postes', permission: FEATURE_PERMISSIONS.positions, path: ['team', 'positions'] },
    { label: 'Rôles', permission: FEATURE_PERMISSIONS.roles, path: ['team', 'roles'] },
    { label: 'Permissions', permission: FEATURE_PERMISSIONS.permissions, path: ['team', 'permissions'] }
  ] },
  { label: 'Référentiels et dossiers', items: [
    { label: 'Élèves', permission: FEATURE_PERMISSIONS.students, path: ['students'] },
    { label: 'Matières', permission: FEATURE_PERMISSIONS.subjects, path: ['referentials'] }
  ] }
] satisfies { label: string; items: PermissionNavItem[] }[];

export const YEAR_NAVIGATION: PermissionNavItem[] = [
  { label: 'Classes', permission: FEATURE_PERMISSIONS.classes, path: ['classes'] },
  { label: 'Inscriptions', permission: FEATURE_PERMISSIONS.enrollments, path: ['enrollments'] },
  { label: 'Présences et absences', permission: FEATURE_PERMISSIONS.attendance, path: ['attendance'] },
  { label: 'Cours et devoirs', permission: FEATURE_PERMISSIONS.learning, path: ['learning'] },
  { label: 'Calendrier', permission: FEATURE_PERMISSIONS.calendar, path: ['calendar'] },
  { label: 'Finances', permission: FEATURE_PERMISSIONS.finance, path: ['finance'] }
];

export const FINANCE_VIEW_PERMISSIONS = {
  payments: 'can_tuition_outstanding_read',
  fees: { any: ['can_tuition_read', { all: ['can_tuition_create', 'can_tuition_fee_type_read'] }] },
  history: { all: ['can_tuition_read', 'can_student_read'] },
  settings: ['can_tuition_fee_type_read', 'can_tuition_fee_type_create', 'can_tuition_read']
} as const satisfies Record<string, PermissionRequirement>;
