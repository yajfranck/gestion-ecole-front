import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { ConfirmationDialogService } from '../../../shared/confirmation-dialog/confirmation-dialog.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Classroom } from '../../../models/classroom/classroom.model';
import { ClassroomService } from '../../../service/classroom-service/classroom.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { apiError } from '../../../shared/api-error';

@Component({ selector: 'app-classroom-manager', imports: [FormModalComponent, FormsModule], templateUrl: './classroom-manager.component.html', styleUrl: './classroom-manager.component.css' })
export class ClassroomManagerComponent implements OnInit {
  protected readonly formCompleted = signal(0);
  private readonly confirmation = inject(ConfirmationDialogService);
  private readonly api = inject(ClassroomService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly access = inject(WorkspaceAccessService);
  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();
  readonly schoolClassId = input.required<string>();
  readonly changed = output<Classroom[]>();
  protected readonly rooms = signal<Classroom[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected editingId: string | null = null;
  protected code = '';
  protected name = '';
  protected maxStudents: number | null = null;
  private mutation: 'create' | 'update' | 'archive' = 'create';

  ngOnInit(): void { this.load(); }
  protected can(action: string): boolean { return this.access.hasPermission(`can_school_class_${action}`, this.establishmentId()); }
  protected load(): void {
    if (!this.access.hasPermission('can_school_class_read', this.establishmentId())) { this.loading.set(false); return; }
    this.loading.set(true);
    this.error.set(null);
    this.api.list(this.establishmentId(), this.academicYearId(), this.schoolClassId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rooms) => {
        const active = rooms.filter((room) => room.enabled && room.establishmentId === this.establishmentId() && room.academicYearId === this.academicYearId() && room.schoolClassId === this.schoolClassId());
        this.rooms.set(active); this.changed.emit(active); this.loading.set(false);
      }, error: (error) => { this.error.set(apiError(error)); this.loading.set(false); }
    });
  }
  protected edit(room: Classroom): void { this.editingId = room.id; this.code = room.code; this.name = room.name; this.maxStudents = room.maxStudents; this.error.set(null); }
  protected cancel(): void { this.editingId = null; this.code = ''; this.name = ''; this.maxStudents = null; }
  protected save(): void {
    const code = this.code.trim().toUpperCase();
    const name = this.name.trim();
    const maxStudents = Number(this.maxStudents);
    if (this.saving() || !this.can(this.editingId ? 'update' : 'create')) return;
    if (!code || code.length > 40 || !name || name.length > 100 || this.maxStudents === null || !Number.isInteger(maxStudents) || maxStudents < 1) {
      this.error.set('Saisissez un code et un nom valides ainsi qu’une capacité entière supérieure ou égale à 1.');
      return;
    }
    this.saving.set(true); this.error.set(null);
    this.mutation = this.editingId ? 'update' : 'create';
    const request = this.editingId
      ? this.api.update(this.establishmentId(), this.academicYearId(), this.schoolClassId(), this.editingId, { code, name, maxStudents })
      : this.api.create(this.establishmentId(), this.academicYearId(), this.schoolClassId(), { code, name, maxStudents });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.saving.set(false); this.formCompleted.update(value => value + 1); this.cancel(); this.load(); }, error: (error) => this.fail(error) });
  }
  protected archive(room: Classroom): void {

    if (this.saving() || !this.can('delete')) return;
    this.confirmation.confirm(`Archiver la salle « ${room.name} » ?`, () => {
    this.mutation = 'archive';
    this.saving.set(true); this.error.set(null);
    this.api.archive(this.establishmentId(), this.academicYearId(), this.schoolClassId(), room.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.saving.set(false); if (this.editingId === room.id) this.cancel(); this.load(); }, error: (error) => this.fail(error)
    });

    });
  }
  private fail(error: unknown): void {
    this.saving.set(false);
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.error.set(this.mutation === 'archive'
        ? 'Cette salle est encore référencée par des inscriptions ou un emploi du temps. Déplacez les élèves et archivez les créneaux avant de réessayer.'
        : this.mutation === 'update'
          ? 'Le code est peut-être déjà utilisé ou la capacité est inférieure au nombre d’élèves déjà inscrits.'
          : 'Ce code de salle est déjà utilisé dans cette classe.');
    } else {
      this.error.set(apiError(error));
    }
  }
}
