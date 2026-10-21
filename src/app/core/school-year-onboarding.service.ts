import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import {
  catchError,
  filter,
  finalize,
  forkJoin,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { AuthService } from './auth.service';
import { WorkspaceAccessService } from './workspace-access.service';
import { AcademicYearService } from '../service/academic-year-service/academic-year.service';
import { EstablishmentService } from '../service/establishment-service/establishment.service';
import { AcademicYear } from '../models/academic-year/academic-year.model';
import { Establishment } from '../models/establishment/establishment.model';
import { WorkspaceContextService } from '../shared/workspace-context.service';
import { apiError } from '../shared/api-error';
import { localDateKey } from '../shared/date-range';

type SetupStatus = 'unknown' | 'required' | 'ready' | 'error';

@Injectable({ providedIn: 'root' })
export class SchoolYearOnboardingService {
  private readonly auth = inject(AuthService);
  private readonly access = inject(WorkspaceAccessService);
  private readonly years = inject(AcademicYearService);
  private readonly establishmentsApi = inject(EstablishmentService);
  private readonly context = inject(WorkspaceContextService);
  readonly status = signal<SetupStatus>('unknown');
  readonly establishmentId = signal<string | null>(null);
  readonly establishment = signal<Establishment | null>(null);
  readonly managedEstablishments = signal<Establishment[]>([]);
  readonly pendingEstablishments = signal<Establishment[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private checkedToken: string | null = null;
  private checkedDate: string | null = null;
  private revision = 0;
  private request: Observable<SetupStatus> | null = null;

  canConfigureSchoolYear(): boolean {
    return this.access.hasAllPermissions(['can_establishment_read', 'can_academic_year_read', 'can_academic_year_create']);
  }

  ensure(force = false): Observable<SetupStatus> {
    const token = this.auth.session()?.accessToken ?? '';
    const today = localDateKey();
    if (token !== this.checkedToken || today !== this.checkedDate) {
      this.checkedToken = token;
      this.checkedDate = today;
      this.revision++;
      this.request = null;
      this.status.set('unknown');
      this.establishmentId.set(null);
      this.establishment.set(null);
      this.managedEstablishments.set([]);
      this.pendingEstablishments.set([]);
      this.error.set(null);
    }
    if (!this.canConfigureSchoolYear()) return of('ready');
    if (this.request) return this.request;
    if (!force && (this.status() === 'required' || this.status() === 'ready'))
      return of(this.status());
    const version = ++this.revision;
    this.loading.set(true);
    this.error.set(null);
    this.request = this.establishmentsApi.getAccessible().pipe(
      switchMap((accessible) => {
        const schools = [
          ...new Map(
            accessible.filter((school) => school.enabled && this.access.hasAllPermissions(['can_academic_year_create', 'can_academic_year_read'], school.id)).map((school) => [school.id, school]),
          ).values(),
        ];
        if (!schools.length)
          return throwError(() => new Error('Aucun établissement actif accessible à configurer.'));
        if (version === this.revision) {
          this.managedEstablishments.set(schools);
          this.establishment.set(schools[0]);
          this.establishmentId.set(schools[0].id);
        }
        return forkJoin(
          schools.map((school) =>
            this.years.getAcademicYears(school.id).pipe(
              map((years) => ({
                school,
                configured: years.some(
                  (year) =>
                    year.enabled &&
                    year.establishmentId === school.id &&
                    year.startsOn <= today &&
                    year.endsOn >= today,
                ),
              })),
              catchError((error: unknown) => {
                if (version === this.revision) {
                  this.establishment.set(school);
                  this.establishmentId.set(school.id);
                }
                return throwError(() => error);
              }),
            ),
          ),
        );
      }),
      map((checks): SetupStatus => {
        const missing = checks.filter((check) => !check.configured).map((check) => check.school);
        if (version === this.revision) {
          this.pendingEstablishments.set(missing);
          const selected = missing[0] ?? checks[0].school;
          this.establishment.set(selected);
          this.establishmentId.set(selected.id);
        }
        return missing.length ? 'required' : 'ready';
      }),
      catchError((error: unknown) => {
        if (version === this.revision) {
          this.pendingEstablishments.set([]);
          const message =
            error instanceof HttpErrorResponse && error.status === 403
              ? 'La vérification des années scolaires est refusée. Vérifiez avec l’administrateur plateforme que la licence et les autorisations de l’école sont actives.'
              : apiError(error);
          this.error.set(
            this.establishment() ? `${this.establishment()!.name} : ${message}` : message,
          );
        }
        return of<SetupStatus>('error');
      }),
      filter(() => version === this.revision),
      tap((status) => this.status.set(status)),
      finalize(() => {
        if (version === this.revision) {
          this.loading.set(false);
          this.request = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.request;
  }

  complete(year: AcademicYear): boolean {
    const today = localDateKey();
    if (
      this.status() !== 'required' ||
      this.checkedToken !== this.auth.session()?.accessToken ||
      this.checkedDate !== today ||
      !year.enabled ||
      year.establishmentId !== this.pendingEstablishments()[0]?.id ||
      year.startsOn > today ||
      year.endsOn < today
    )
      return false;
    const school = this.pendingEstablishments()[0];
    this.context.selectEstablishment(school);
    this.context.setAcademicYears([year]);
    this.context.selectAcademicYear(year);
    const remaining = this.pendingEstablishments().slice(1);
    this.pendingEstablishments.set(remaining);
    this.establishment.set(remaining[0] ?? school);
    this.establishmentId.set((remaining[0] ?? school).id);
    this.status.set(remaining.length ? 'required' : 'ready');
    this.error.set(null);
    return true;
  }
}
