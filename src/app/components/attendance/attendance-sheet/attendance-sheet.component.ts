import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { AttendanceEntry, AttendanceInput, AttendanceSheet, AttendanceStatus } from '../../../models/attendance/attendance.model';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { AttendanceService } from '../../../service/attendance-service/attendance.service';
import { ClassroomService } from '../../../service/classroom-service/classroom.service';
import { Classroom } from '../../../models/classroom/classroom.model';
import { PendingChangesService } from '../../../shared/pending-changes.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';

@Component({
  selector: 'app-attendance-sheet',
  imports: [FormsModule, RouterLink],
  templateUrl: './attendance-sheet.component.html',
  styleUrl: './attendance-sheet.component.css'
})
export class AttendanceSheetComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly years = inject(AcademicYearService);
  private readonly attendance = inject(AttendanceService);
  private readonly classroomsApi = inject(ClassroomService);
  protected readonly access = inject(WorkspaceAccessService);
  protected readonly context = inject(WorkspaceContextService);
  protected readonly pending = inject(PendingChangesService);
  protected readonly year = this.context.academicYear;
  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly rooms = signal<Classroom[]>([]);
  protected readonly rows = signal<AttendanceEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadingRooms = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly conflict = signal(false);
  protected readonly classId = signal('');
  protected readonly classroomId = signal('');
  protected readonly date = signal('');
  protected readonly loaded = signal(false);
  protected readonly canRead = computed(() => this.access.hasPermission('can_attendance_read', this.year()?.establishmentId ?? ''));
  protected readonly canWrite = computed(() => this.canRead() && this.access.hasPermission('can_attendance_write', this.year()?.establishmentId ?? ''));
  protected readonly canEdit = computed(() => this.canWrite() && !!this.classroomId());
  protected readonly present = computed(() => this.rows().filter((row) => row.status === 'PRESENT').length);
  protected readonly absent = computed(() => this.rows().filter((row) => row.status === 'ABSENT').length);
  protected readonly unreported = computed(() => this.rows().filter((row) => row.status === 'NON_RENSEIGNE').length);
  private baseline: AttendanceEntry[] = [];
  private request?: Subscription;
  private roomRequest?: Subscription;

  ngOnInit(): void {
    this.route.parent!.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reset());
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
    this.roomRequest?.unsubscribe();
    this.pending.dirty.set(false);
    this.pending.saving.set(false);
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.pending.dirty() || this.pending.saving()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  protected reset(): void {
    this.request?.unsubscribe();
    this.roomRequest?.unsubscribe();
    this.rows.set([]);
    this.baseline = [];
    this.classes.set([]);
    this.rooms.set([]);
    this.classId.set('');
    this.classroomId.set('');
    this.loaded.set(false);
    this.error.set(null);
    this.success.set(null);
    this.conflict.set(false);
    this.loading.set(false);
    this.loadingRooms.set(false);
    this.pending.dirty.set(false);
    const year = this.year();
    if (!year || !this.canRead()) return;
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.date.set(localDate < year.startsOn ? year.startsOn : localDate > year.endsOn ? year.endsOn : localDate);
    this.loading.set(true);
    this.request = this.years.getClasses(year.establishmentId, year.id).subscribe({
      next: (classes) => {
        this.classes.set(classes.filter((item) => item.establishmentId === year.establishmentId && item.academicYearId === year.id && item.enabled));
        this.loading.set(false);
      },
      error: (error: unknown) => this.fail(error)
    });
  }

  protected changeClass(value: string, select: HTMLSelectElement): void {
    if (!this.pending.confirmLeave()) { select.value = this.classId(); return; }
    this.roomRequest?.unsubscribe();
    this.request?.unsubscribe();
    this.classId.set(value);
    this.classroomId.set('');
    this.rooms.set([]);
    this.rows.set([]);
    this.baseline = [];
    this.loaded.set(false);
    this.error.set(null);
    this.success.set(null);
    this.conflict.set(false);
    this.loadingRooms.set(false);
    if (value) this.loadRooms();
    else this.loading.set(false);
  }

  protected changeClassroom(value: string, select: HTMLSelectElement): void {
    if (!this.pending.confirmLeave()) { select.value = this.classroomId(); return; }
    this.classroomId.set(value);
    this.load();
  }

  protected changeDate(value: string, input: HTMLInputElement): void {
    if (!this.pending.confirmLeave()) { input.value = this.date(); return; }
    this.date.set(value);
    this.load();
  }

  protected load(): void {
    this.request?.unsubscribe();
    this.roomRequest?.unsubscribe();
    this.rows.set([]);
    this.baseline = [];
    this.loaded.set(false);
    this.error.set(null);
    this.success.set(null);
    this.conflict.set(false);
    const year = this.year();
    if (!year || !this.classId()) { this.loading.set(false); return; }
    if (!this.validDate(this.date())) {
      this.loading.set(false);
      this.error.set('Choisissez une date comprise dans l’année scolaire.');
      return;
    }
    this.loading.set(true);
    this.request = this.attendance.getSheet(year.establishmentId, year.id, this.classId(), this.date(), this.classroomId() || undefined).subscribe({
      next: (sheet) => this.accept(sheet),
      error: (error: unknown) => this.fail(error)
    });
  }

  protected loadRooms(): void {
    this.roomRequest?.unsubscribe();
    this.request?.unsubscribe();
    this.rooms.set([]);
    this.classroomId.set('');
    this.rows.set([]);
    this.baseline = [];
    this.loaded.set(false);
    this.error.set(null);
    this.success.set(null);
    this.conflict.set(false);
    const year = this.year();
    const classId = this.classId();
    if (!year || !classId) { this.loadingRooms.set(false); this.loading.set(false); return; }
    this.loadingRooms.set(true);
    this.roomRequest = this.classroomsApi.list(year.establishmentId, year.id, classId).subscribe({
      next: (rooms) => {
        const activeRooms = rooms.filter((room) => room.enabled && room.establishmentId === year.establishmentId && room.academicYearId === year.id && room.schoolClassId === classId);
        this.rooms.set(activeRooms);
        this.loadingRooms.set(false);
        if (activeRooms.length === 1) this.classroomId.set(activeRooms[0].id);
        this.load();
      },
      error: (error: unknown) => {
        this.loadingRooms.set(false);
        this.fail(error);
      }
    });
  }

  protected update(studentId: string, changes: Partial<Pick<AttendanceEntry, 'status' | 'absenceJustified' | 'comment'>>): void {
    if (!this.canEdit() || this.pending.saving()) return;
    const original = this.baseline.find((row) => row.studentId === studentId);
    if (changes.status === 'NON_RENSEIGNE' && original?.status !== 'NON_RENSEIGNE') return;
    this.rows.update((rows) => rows.map((row) => {
      if (row.studentId !== studentId) return row;
      const updated = { ...row, ...changes };
      if (updated.status !== 'ABSENT') updated.absenceJustified = false;
      if (updated.status === 'NON_RENSEIGNE') updated.comment = null;
      return updated;
    }));
    this.pending.dirty.set(this.rows().some((row, index) => this.changed(row, this.baseline[index])));
    this.success.set(null);
  }

  protected status(studentId: string, value: string): void {
    if (['PRESENT', 'ABSENT', 'NON_RENSEIGNE'].includes(value)) this.update(studentId, { status: value as AttendanceStatus });
  }

  protected wasUnreported(studentId: string): boolean {
    return this.baseline.find((row) => row.studentId === studentId)?.status === 'NON_RENSEIGNE';
  }

  protected markUnreported(): void {
    if (!this.canEdit()) return;
    for (const row of this.rows()) {
      if (row.status === 'NON_RENSEIGNE') this.update(row.studentId, { status: 'PRESENT' });
    }
  }

  protected discard(): void {
    if (!this.pending.confirmLeave()) return;
    this.load();
  }

  protected save(): void {
    const year = this.year();
    if (!year || !this.canEdit() || !this.pending.dirty() || this.pending.saving() || this.conflict()) return;
    const entries: AttendanceInput[] = this.rows().flatMap((row, index) => {
      if (row.status === 'NON_RENSEIGNE' || !this.changed(row, this.baseline[index])) return [];
      return [{ studentId: row.studentId, status: row.status, absenceJustified: row.absenceJustified,
        comment: row.comment?.trim() || null, ...(row.updatedAt ? { expectedUpdatedAt: row.updatedAt } : {}) }];
    });
    if (!entries.length) return;
    if (entries.some((entry) => (entry.comment?.length ?? 0) > 500)) {
      this.error.set('Un commentaire ne peut pas dépasser 500 caractères.');
      return;
    }
    this.pending.saving.set(true);
    this.error.set(null);
    this.request = this.attendance.save(year.establishmentId, year.id, this.classId(), this.date(), this.classroomId(), entries).subscribe({
      next: (sheet) => {
        this.accept(sheet);
        this.success.set('Appel enregistré.');
      },
      error: (error: unknown) => {
        this.pending.saving.set(false);
        this.conflict.set(error instanceof HttpErrorResponse && error.status === 409);
        this.fail(error);
      }
    });
  }

  private accept(sheet: AttendanceSheet): void {
    const year = this.year();
    if (sheet.establishmentId !== year?.establishmentId || sheet.academicYearId !== year.id ||
      sheet.schoolClassId !== this.classId() || sheet.classroomId !== (this.classroomId() || null) || sheet.date !== this.date()) {
      this.fail(new Error('Contexte incohérent'));
      return;
    }
    this.baseline = sheet.entries.map((entry) => ({ ...entry }));
    this.rows.set(sheet.entries.map((entry) => ({ ...entry })));
    this.loaded.set(true);
    this.loading.set(false);
    this.pending.saving.set(false);
    this.pending.dirty.set(false);
    this.conflict.set(false);
  }

  private changed(row: AttendanceEntry, original: AttendanceEntry): boolean {
    return row.status !== original.status || row.absenceJustified !== original.absenceJustified || (row.comment ?? '') !== (original.comment ?? '');
  }

  private validDate(value: string): boolean {
    const year = this.year();
    return !!year && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= year.startsOn && value <= year.endsOn;
  }

  private fail(error: unknown): void {
    this.loading.set(false);
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    this.error.set(status === 409 ? 'Cet appel a été modifié ailleurs. Votre saisie est conservée. Rechargez les données avant de corriger à nouveau.'
      : status === 403 ? 'Accès refusé pour cet établissement ou cette opération.'
      : status === 400 ? 'Données invalides : vérifiez la date, les pointages et les commentaires.'
      : status === 404 ? 'Année, classe ou inscription absente, archivée ou hors périmètre.'
      : 'Impossible de charger ou d’enregistrer l’appel. Réessayez.');
  }
}