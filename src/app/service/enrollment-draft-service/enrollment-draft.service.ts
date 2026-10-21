import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { tokenClaims } from '../../core/auth-claims';
import { emptyEnrollmentSelection, EnrollmentDraft } from '../../models/enrollment/enrollment-draft.model';

export const ENROLLMENT_DRAFT_STORAGE = new InjectionToken<Storage | null>('ENROLLMENT_DRAFT_STORAGE', {
  providedIn: 'root', factory: () => { try { return localStorage; } catch { return null; } }
});
export const ENROLLMENT_DRAFT_OWNER = new InjectionToken<() => string | null>('ENROLLMENT_DRAFT_OWNER', {
  providedIn: 'root', factory: () => {
    const auth = inject(AuthService);
    return () => { const subject = tokenClaims(auth.session()?.accessToken)['sub']; return typeof subject === 'string' && subject ? subject : null; };
  }
});

/** Les brouillons locaux ne remplacent jamais les contrôles ni les écritures métier de l’API. */
@Injectable({ providedIn: 'root' })
export class EnrollmentDraftService {
  private readonly storage = inject(ENROLLMENT_DRAFT_STORAGE);
  private readonly owner = inject(ENROLLMENT_DRAFT_OWNER);
  readonly revision = signal(0);

  create(establishmentId: string, academicYearId: string): EnrollmentDraft {
    return { version: 1, ownerId: this.owner() ?? '', id: crypto.randomUUID(), establishmentId, academicYearId, updatedAt: new Date().toISOString(), step: 1,
      studentId: null, identity: { firstName: '', lastName: '' }, guardian: { firstName: '', lastName: '', email: '' }, guardians: [], selection: emptyEnrollmentSelection() };
  }

  list(establishmentId: string, academicYearId: string): EnrollmentDraft[] {
    this.revision();
    const key = this.key(establishmentId, academicYearId);
    if (!key) return [];
    try {
      const values: unknown = JSON.parse(this.storage?.getItem(key) ?? '[]');
      if (!Array.isArray(values)) return [];
      return values.filter((item): item is EnrollmentDraft => this.valid(item, establishmentId, academicYearId))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    } catch { return []; }
  }

  save(draft: EnrollmentDraft): boolean {
    const key = this.key(draft.establishmentId, draft.academicYearId);
    if (!key || !this.storage || !this.valid(draft, draft.establishmentId, draft.academicYearId)) return false;
    try {
      const items = this.list(draft.establishmentId, draft.academicYearId).filter(item => item.id !== draft.id);
      this.storage.setItem(key, JSON.stringify([{ ...draft, updatedAt: new Date().toISOString() }, ...items]));
      this.revision.update(value => value + 1);
      return true;
    } catch { return false; }
  }

  remove(establishmentId: string, academicYearId: string, id: string): boolean {
    const key = this.key(establishmentId, academicYearId);
    if (!key || !this.storage) return false;
    try {
      this.storage.setItem(key, JSON.stringify(this.list(establishmentId, academicYearId).filter(item => item.id !== id)));
      this.revision.update(value => value + 1);
      return true;
    } catch { return false; }
  }

  private key(establishmentId: string, academicYearId: string): string | null {
    const owner = this.owner();
    return owner && establishmentId && academicYearId
      ? `gestion-ecole.enrollment-drafts.v1:${encodeURIComponent(owner)}:${encodeURIComponent(establishmentId)}:${encodeURIComponent(academicYearId)}` : null;
  }

  private valid(value: unknown, establishmentId: string, academicYearId: string): value is EnrollmentDraft {
    if (!value || typeof value !== 'object') return false;
    const item = value as Partial<EnrollmentDraft>;
    return item.version === 1 && item.ownerId === this.owner() && typeof item.id === 'string' && !!item.id && item.establishmentId === establishmentId && item.academicYearId === academicYearId
      && typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) && Number.isInteger(item.step) && item.step! >= 1 && item.step! <= 3
      && (item.studentId === null || typeof item.studentId === 'string')
      && !!item.identity && typeof item.identity.firstName === 'string' && item.identity.firstName.length <= 100 && typeof item.identity.lastName === 'string' && item.identity.lastName.length <= 100
      && !!item.guardian && typeof item.guardian.firstName === 'string' && item.guardian.firstName.length <= 100 && typeof item.guardian.lastName === 'string' && item.guardian.lastName.length <= 100 && typeof item.guardian.email === 'string' && item.guardian.email.length <= 254
      && (item.guardians === undefined || (Array.isArray(item.guardians) && item.guardians.length <= 100 && item.guardians.every(guardian => !!guardian && typeof guardian.firstName === 'string' && guardian.firstName.length <= 100 && typeof guardian.lastName === 'string' && guardian.lastName.length <= 100 && typeof guardian.email === 'string' && guardian.email.length <= 254)))
      && !!item.selection && typeof item.selection.schoolClassId === 'string' && typeof item.selection.classroomId === 'string' && [1, 2, 3].includes(item.selection.phase)
      && typeof item.selection.acceptAdvance === 'boolean' && Array.isArray(item.selection.payments) && item.selection.payments.length <= 100
      && item.selection.payments.every(payment => !!payment && typeof payment.feeId === 'string' && (payment.amount === null || (typeof payment.amount === 'number' && Number.isFinite(payment.amount) && payment.amount >= 0)) && typeof payment.method === 'string' && typeof payment.reference === 'string' && payment.reference.length <= 120);
  }
}
