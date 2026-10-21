import { LicenseState, PlatformLicense } from './license.model';

export type LicenseSummaryStatus = LicenseState | 'NONE';

export interface LicenseSummary {
  status: LicenseSummaryStatus;
  validFrom: string | null;
  validUntil: string | null;
  offerName: string | null;
}

const PRIORITY: readonly LicenseState[] = ['ACTIVE', 'UPCOMING', 'SUSPENDED', 'EXPIRED'];
const BLOCKING: readonly LicenseState[] = ['ACTIVE', 'UPCOMING', 'SUSPENDED'];

/** Retient la licence la plus pertinente selon l'état calculé par le serveur. */
export function summarizeLicenses(licenses: readonly PlatformLicense[]): LicenseSummary {
  for (const state of PRIORITY) {
    const [best] = licenses
      .filter((license) => license.state === state)
      .sort((a, b) => (b.validUntil ?? '\uffff').localeCompare(a.validUntil ?? '\uffff'));
    if (best) return { status: state, validFrom: best.validFrom, validUntil: best.validUntil, offerName: best.offerName };
  }
  return { status: 'NONE', validFrom: null, validUntil: null, offerName: null };
}

/** Une licence active, à venir ou suspendue interdit d'en enregistrer une seconde. */
export function findBlockingLicense(licenses: readonly PlatformLicense[]): PlatformLicense | undefined {
  return licenses.find((license) => BLOCKING.includes(license.state));
}
