import { LicenseFeature } from '../license/license.model';

export interface DashboardYear { id: string; name: string; startsOn: string; endsOn: string }
export interface PlatformDashboard {
  totalEstablishments: number;
  activeEstablishments: number;
  disabledEstablishments: number;
  activeLicenses: number;
  suspendedLicenses: number;
  expiredLicenses: number;
  upcomingLicenses: number;
  establishmentsWithoutActiveLicense: number;
}
export interface EstablishmentDashboard {
  id: string;
  name: string;
  academicYear: DashboardYear | null;
  license: { state: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'UPCOMING' | 'UNLICENSED'; offerCode: string | null; validFrom: string | null; validUntil: string | null; features: LicenseFeature[] };
  counts: { students: number; employees: number; subjects: number; classes: number; enrollments: number };
  classes: { id: string; code: string; name: string; series: string | null; students: number }[];
  attendance: { date: string; present: number; absent: number; justifiedAbsent: number; notRecorded: number } | null;
  finance: { currency: string; amountBilled: number; amountPaid: number; balance: number; overdueBalance: number }[] | null;
  learning: { draftLessons: number; publishedLessons: number; draftAssignments: number; publishedAssignments: number } | null;
}
export type Dashboard = { generatedAt: string } & (
  { scope: 'PLATFORM'; platform: PlatformDashboard; establishment: null } |
  { scope: 'ESTABLISHMENT'; platform: null; establishment: EstablishmentDashboard }
);
