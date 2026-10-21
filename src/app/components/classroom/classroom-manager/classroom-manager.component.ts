import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucidePlus, LucideTrash2 } from '@lucide/angular';
import { concatMap, from, tap } from 'rxjs';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { Classroom, ClassroomRequest } from '../../../models/classroom/classroom.model';
import { ClassroomService } from '../../../service/classroom-service/classroom.service';
import { ToastService } from '../../../service/toast-service/toast.service';
import { apiError } from '../../../shared/api-error';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { FormRowsComponent } from '../../../shared/form-rows/form-rows.component';

interface RoomRow {
  key: number;
  saved: Classroom | null;
  code: string;
  name: string;
  maxStudents: number | null;
}

@Component({
  selector: 'app-classroom-manager',
  imports: [FormsModule, FormRowsComponent, LucidePlus, LucideTrash2],
  templateUrl: './classroom-manager.component.html',
  styleUrl: './classroom-manager.component.css'
})
export class ClassroomManagerComponent implements OnInit {
  private readonly confirmation = inject(ConfirmationDialogService);
  private readonly api = inject(ClassroomService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  protected readonly access = inject(WorkspaceAccessService);
  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();
  readonly schoolClassId = input.required<string>();
  readonly changed = output<Classroom[]>();
  readonly canceled = output<void>();
  readonly saving = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected rows: RoomRow[] = [];
  private nextKey = 0;
  private mutation: 'create' | 'update' | 'archive' = 'create';

  ngOnInit(): void { this.load(); }

  protected can(action: string): boolean {
    return this.access.hasPermission(`can_school_class_${action}`, this.establishmentId());
  }

  protected load(): void {
    if (!this.can('read') || this.saving()) return;
    this.loading.set(true); this.loadError.set(null);
    this.api.list(this.establishmentId(), this.academicYearId(), this.schoolClassId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rooms => {
        this.rows = rooms.filter(room => room.enabled && room.establishmentId === this.establishmentId() && room.academicYearId === this.academicYearId() && room.schoolClassId === this.schoolClassId())
          .map(room => ({ key: this.nextKey++, saved: room, code: room.code, name: room.name, maxStudents: room.maxStudents }));
        this.emitRooms(); this.loading.set(false);
        if (!this.rows.length) this.add();
      },
      error: (error: unknown) => { this.loadError.set(apiError(error)); this.loading.set(false); }
    });
  }

  protected add(): void {
    if (this.saving() || !this.can('create') || this.rows.filter(row => !row.saved).length >= 100) return;
    this.rows = [...this.rows, { key: this.nextKey++, saved: null, code: '', name: '', maxStudents: null }];
  }

  protected canAdd(): boolean { return this.can('create') && this.rows.filter(row => !row.saved).length < 100; }

  protected hasChanges(): boolean {
    return this.rows.some(row => row.saved ? this.can('update') && this.isModified(row) : this.can('create'));
  }

  protected remove(row: RoomRow): void {
    if (this.saving()) return;
    const room = row.saved;
    if (!room) { this.rows = this.rows.filter(item => item.key !== row.key); return; }
    if (!this.can('delete')) return;
    this.confirmation.confirm(`Archiver la salle « ${room.name} » ?`, () => {
      if (this.destroyRef.destroyed || this.saving() || !this.can('delete') || !this.rows.includes(row)) return;
      this.mutation = 'archive'; this.saving.set(true); this.error.set(null);
      this.api.archive(this.establishmentId(), this.academicYearId(), this.schoolClassId(), room.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.rows = this.rows.filter(item => item.key !== row.key); this.emitRooms();
          this.saving.set(false); this.toast.success('La salle a été archivée.');
        },
        error: (error: unknown) => this.fail(error)
      });
    }, 'Archiver une salle');
  }

  protected save(): void {
    if (this.saving()) return;
    const changes = this.rows.filter(row => row.saved ? this.can('update') && this.isModified(row) : this.can('create'));
    if (!changes.length) return;
    const requests = changes.map(row => ({ row, request: this.request(row) }));
    if (requests.some(({ request, row }) => !request.code || request.code.length > 40 || !request.name || request.name.length > 100 || row.maxStudents === null || !Number.isInteger(request.maxStudents) || request.maxStudents < 1)) {
      this.error.set('Renseignez un code, un nom et une capacité entière supérieure ou égale à 1 pour chaque salle.'); return;
    }
    const codes = this.rows.map(row => row.code.trim().toUpperCase());
    if (new Set(codes).size !== codes.length) { this.error.set('Chaque salle doit avoir un code différent.'); return; }
    this.saving.set(true); this.error.set(null);
    // L’API est unitaire : conserver chaque succès pour ne pas le recréer en cas de reprise.
    from(requests).pipe(
      concatMap(({ row, request }) => {
        this.mutation = row.saved ? 'update' : 'create';
        const call = row.saved
          ? this.api.update(this.establishmentId(), this.academicYearId(), this.schoolClassId(), row.saved.id, request)
          : this.api.create(this.establishmentId(), this.academicYearId(), this.schoolClassId(), request);
        return call.pipe(tap(room => {
          row.saved = room; row.code = room.code; row.name = room.name; row.maxStudents = room.maxStudents;
          this.emitRooms();
        }));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      complete: () => { if (!this.destroyRef.destroyed) { this.saving.set(false); this.toast.success('Les salles ont été enregistrées.'); } },
      error: (error: unknown) => this.fail(error)
    });
  }

  private request(row: RoomRow): ClassroomRequest {
    return { code: row.code.trim().toUpperCase(), name: row.name.trim(), maxStudents: Number(row.maxStudents) };
  }

  private isModified(row: RoomRow): boolean {
    const value = this.request(row);
    return row.saved?.code !== value.code || row.saved?.name !== value.name || row.saved?.maxStudents !== value.maxStudents;
  }

  private emitRooms(): void { this.changed.emit(this.rows.flatMap(row => row.saved ? [row.saved] : [])); }

  private fail(error: unknown): void {
    this.saving.set(false);
    this.error.set(error instanceof HttpErrorResponse && error.status === 409
      ? this.mutation === 'archive'
        ? 'Cette salle est encore référencée par des inscriptions ou un emploi du temps. Déplacez les élèves et archivez les créneaux avant de réessayer.'
        : this.mutation === 'update'
          ? 'Le code est peut-être déjà utilisé ou la capacité est inférieure au nombre d’élèves déjà inscrits. Votre saisie est conservée.'
          : 'Ce code de salle est déjà utilisé dans cette classe. Votre saisie est conservée.'
      : apiError(error));
  }
}
