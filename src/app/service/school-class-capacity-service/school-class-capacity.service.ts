import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, from, mergeMap, Subscription, tap } from 'rxjs';
import { WorkspaceAccessService } from '../../core/workspace-access.service';
import { Classroom } from '../../models/classroom/classroom.model';
import { Enrollment } from '../../models/enrollment/enrollment.model';
import { SchoolClassCapacity } from '../../models/school-class/school-class-capacity.model';
import { ClassroomService } from '../classroom-service/classroom.service';
import { EnrollmentService } from '../enrollment-service/enrollment.service';

type LoadState = 'loading' | 'ready' | 'error' | 'restricted';
interface RoomState { state: LoadState; rooms: Classroom[] }

/** Indicateurs en mémoire, limités à la page de classes et à son année scolaire. */
@Injectable()
export class SchoolClassCapacityService {
  private readonly api = inject(ClassroomService);
  private readonly enrollmentApi = inject(EnrollmentService);
  private readonly access = inject(WorkspaceAccessService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rooms = signal<Record<string, RoomState>>({});
  private readonly enrollments = signal<Enrollment[]>([]);
  private readonly enrollmentState = signal<LoadState>('loading');
  private scope: { establishmentId: string; academicYearId: string } | null = null;
  private reads = new Subscription();
  private readonly roomVersions = new Map<string, number>();

  readonly indicators = computed<Record<string, SchoolClassCapacity>>(() => {
    const byClass = new Map<string, number>();
    const byRoom = new Map<string, number>();
    for (const enrollment of this.enrollments()) {
      byClass.set(enrollment.schoolClassId, (byClass.get(enrollment.schoolClassId) ?? 0) + 1);
      byRoom.set(enrollment.classroomId, (byRoom.get(enrollment.classroomId) ?? 0) + 1);
    }
    const enrollmentState = this.enrollmentState();
    return Object.fromEntries(Object.entries(this.rooms()).map(([classId, entry]) => {
      const roomsReady = entry.state === 'ready';
      const enrollmentsReady = enrollmentState === 'ready';
      return [classId, {
        enrolled: enrollmentsReady ? byClass.get(classId) ?? 0 : null,
        activeRooms: roomsReady ? entry.rooms.length : null,
        capacity: roomsReady ? entry.rooms.reduce((sum, room) => sum + room.maxStudents, 0) : null,
        remaining: roomsReady && enrollmentsReady
          ? entry.rooms.reduce((sum, room) => sum + Math.max(0, room.maxStudents - (byRoom.get(room.id) ?? 0)), 0) : null,
        loading: entry.state === 'loading' || enrollmentState === 'loading',
        error: entry.state === 'error' || enrollmentState === 'error',
        restricted: enrollmentState === 'restricted'
      }];
    }));
  });

  readonly loading = computed(() => Object.values(this.indicators()).some(indicator => indicator.loading));
  readonly error = computed(() => Object.values(this.indicators()).some(indicator => indicator.error));

  load(establishmentId: string, academicYearId: string, classIds: string[]): void {
    this.reads.unsubscribe(); this.reads = new Subscription(); this.roomVersions.clear();
    this.scope = { establishmentId, academicYearId };
    this.enrollments.set([]);
    const permitted = this.access.hasPermission('can_school_class_read', establishmentId);
    const ids = permitted ? [...new Set(classIds)] : [];
    this.rooms.set(Object.fromEntries(ids.map(id => [id, { state: 'loading', rooms: [] }])));
    const canReadEnrollments = permitted && this.access.hasPermission('can_enrollment_read', establishmentId);
    this.enrollmentState.set(canReadEnrollments && ids.length ? 'loading' : 'restricted');
    if (!ids.length) return;
    const allowedIds = new Set(ids);

    if (canReadEnrollments) {
      this.reads.add(this.enrollmentApi.getEnrollments(establishmentId, academicYearId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: enrollments => {
          // Une seule lecture pour toute l’année ; les brouillons locaux ne sont pas des inscriptions.
          this.enrollments.set(enrollments.filter(enrollment => enrollment.establishmentId === establishmentId && enrollment.academicYearId === academicYearId && allowedIds.has(enrollment.schoolClassId)));
          this.enrollmentState.set('ready');
        },
        error: () => this.enrollmentState.set('error')
      }));
    }
    // Limiter les requêtes simultanées pour les établissements comportant beaucoup de classes.
    this.reads.add(from(ids).pipe(mergeMap(classId => {
      const version = this.roomVersions.get(classId) ?? 0;
      return this.api.list(establishmentId, academicYearId, classId).pipe(
        tap(rooms => { if ((this.roomVersions.get(classId) ?? 0) === version) this.setClassrooms(classId, rooms); }),
        catchError(() => {
          if ((this.roomVersions.get(classId) ?? 0) === version) this.rooms.update(entries => ({ ...entries, [classId]: { state: 'error', rooms: [] } }));
          return EMPTY;
        })
      );
    }, 4), takeUntilDestroyed(this.destroyRef)).subscribe());
  }

  setClassrooms(classId: string, rooms: Classroom[]): void {
    const scope = this.scope;
    if (!scope || !this.rooms()[classId]) return;
    this.roomVersions.set(classId, (this.roomVersions.get(classId) ?? 0) + 1);
    const active = rooms.filter(room => room.enabled && room.establishmentId === scope.establishmentId && room.academicYearId === scope.academicYearId && room.schoolClassId === classId);
    this.rooms.update(entries => ({ ...entries, [classId]: { state: 'ready', rooms: active } }));
  }
}
