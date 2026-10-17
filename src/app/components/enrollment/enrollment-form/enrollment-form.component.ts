import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, HostListener, input, OnDestroy, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, of, switchMap } from 'rxjs';
import { Classroom } from '../../../models/classroom/classroom.model';
import { Enrollment, EnrollmentCreation, EnrollmentPaymentRequest } from '../../../models/enrollment/enrollment.model';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { Student } from '../../../models/student/student.model';
import { TuitionFee, TuitionPaymentMethod } from '../../../models/tuition/tuition.model';
import { ClassroomService } from '../../../service/classroom-service/classroom.service';
import { EnrollmentService } from '../../../service/enrollment-service/enrollment.service';
import { TuitionService } from '../../../service/tuition-service/tuition.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { PendingChangesService } from '../../../shared/pending-changes.service';
import { apiError } from '../../../shared/api-error';

interface FeeLine { fee: TuitionFee; balance: number; previouslyPaid: number; amount: number | null; method: string; reference: string }

@Component({ selector: 'app-enrollment-form', imports: [FormsModule, CurrencyPipe], templateUrl: './enrollment-form.component.html', styleUrl: './enrollment-form.component.css' })
export class EnrollmentFormComponent implements OnDestroy {
  private readonly pending = inject(PendingChangesService);
  private readonly roomsApi = inject(ClassroomService);
  private readonly tuition = inject(TuitionService);
  private readonly api = inject(EnrollmentService);
  private readonly access = inject(WorkspaceAccessService);
  private readonly destroyRef = inject(DestroyRef);
  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();
  readonly students = input<Student[]>([]);
  readonly classes = input<SchoolClass[]>([]);
  readonly enrollments = input<Enrollment[]>([]);
  readonly initialStudentId = input('');
  readonly initialClassId = input('');
  readonly initialClassroomId = input('');
  readonly created = output<EnrollmentCreation>();
  protected readonly step = signal(1);
  protected readonly rooms = signal<Classroom[]>([]);
  protected readonly loadingRooms = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly roomError = signal<string | null>(null);
  protected readonly lines = signal<FeeLine[]>([]);
  protected readonly methods = signal<TuitionPaymentMethod[]>([]);
  protected readonly unpaidFeeIds = signal<string[]>([]);
  protected studentId = '';
  protected schoolClassId = '';
  protected classroomId = '';
  protected acceptAdvance = false;
  private revision = 0;
  private roomsRevision = 0;

  constructor() {
    effect(() => {
      const studentId = this.initialStudentId();
      const classId = this.initialClassId();
      const students = this.students();
      const classes = this.classes();
      const enrollments = this.enrollments();
      untracked(() => {
        this.studentId = students.some((student) => student.id === studentId && student.enabled) && !enrollments.some((item) => item.studentId === studentId) ? studentId : '';
        this.schoolClassId = classes.some((item) => item.id === classId && item.enabled) ? classId : '';
        this.selectionChanged(true);
      });
    });
  }

  ngOnDestroy(): void { this.pending.dirty.set(false); this.pending.saving.set(false); }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void { if (this.pending.dirty() || this.pending.saving()) { event.preventDefault(); event.returnValue = ''; } }

  protected hasEnrollment(id: string): boolean { return this.enrollments().some((item) => item.studentId === id); }
  protected canPay(): boolean { return this.access.authorities().includes('can_payment_record'); }

  protected selectionChanged(classChanged = false): void {
    this.revision++;
    this.step.set(1); this.lines.set([]); this.error.set(null); this.unpaidFeeIds.set([]); this.acceptAdvance = false; this.loading.set(false);
    if (classChanged) { this.classroomId = ''; this.rooms.set([]); this.loadRooms(); }
  }

  protected loadRooms(): void {
    const classId = this.schoolClassId;
    this.roomError.set(null);
    if (!classId) { this.roomsRevision++; this.loadingRooms.set(false); return; }
    const version = ++this.roomsRevision;
    this.loadingRooms.set(true);
    this.roomsApi.list(this.establishmentId(), this.academicYearId(), classId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rooms) => {
        if (version !== this.roomsRevision) return;
        const available = rooms.filter((room) => room.enabled && room.establishmentId === this.establishmentId() && room.academicYearId === this.academicYearId() && room.schoolClassId === classId);
        this.rooms.set(available);
        const requested = this.initialClassroomId();
        this.classroomId = available.some((room) => room.id === requested) ? requested : available.length === 1 ? available[0].id : '';
        this.loadingRooms.set(false);
      }, error: (error) => { if (version !== this.roomsRevision) return; this.roomError.set(apiError(error)); this.loadingRooms.set(false); }
    });
  }

  protected prepare(preservePayments = false): void {
    if (this.loading() || this.saving() || this.loadingRooms()) return;
    if (!this.students().some((student) => student.id === this.studentId && student.enabled && student.establishmentId === this.establishmentId()) || this.hasEnrollment(this.studentId) ||
        !this.classes().some((item) => item.id === this.schoolClassId && item.enabled && item.establishmentId === this.establishmentId() && item.academicYearId === this.academicYearId()) ||
        !this.rooms().some((room) => room.id === this.classroomId)) { this.error.set('Choisissez un élève non inscrit, une classe et une salle active de cette classe.'); return; }
    const selectedRoom = this.rooms().find((room) => room.id === this.classroomId);
    if (selectedRoom && this.roomOccupancy(selectedRoom.id) >= selectedRoom.maxStudents) {
      this.error.set('Cette salle a atteint sa capacité maximale. Choisissez une autre salle ou augmentez sa capacité si vous y êtes autorisé.');
      return;
    }
    const version = ++this.revision;
    const previous = new Map(preservePayments ? this.lines().map((line) => [line.fee.id, line] as const) : []);
    this.loading.set(true); this.error.set(null);
    this.tuition.getTuitionFees(this.establishmentId(), this.academicYearId()).pipe(switchMap((fees) => {
      const applicable = fees.filter((fee) => fee.establishmentId === this.establishmentId() && fee.academicYearId === this.academicYearId() && (
        fee.scope === 'ACADEMIC_YEAR' || (fee.scope === 'SCHOOL_CLASS' && (fee.schoolClassIds ?? (fee.schoolClassId ? [fee.schoolClassId] : [])).includes(this.schoolClassId)) || (fee.scope === 'STUDENT' && fee.studentId === this.studentId)
      ));
      return applicable.length ? forkJoin({ fees: of(applicable), charges: this.tuition.getStudentCharges(this.establishmentId(), this.studentId), methods: this.tuition.getPaymentMethods(this.establishmentId()) })
        : of({ fees: [], charges: [], methods: [] });
    }), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ fees, charges, methods }) => {
        if (version !== this.revision) return;
        this.methods.set(methods);
        this.lines.set(fees.map((fee) => {
          const charge = charges.find((item) => item.feeId === fee.id && item.studentId === this.studentId && item.academicYearId === this.academicYearId() && item.establishmentId === this.establishmentId());
          const balance = Math.max(0, charge?.balance ?? fee.amount);
          const saved = previous.get(fee.id);
          return { fee, balance, previouslyPaid: charge?.totalPaid ?? 0, amount: saved ? saved.amount : balance || null, method: saved?.method ?? methods[0]?.code ?? '', reference: saved?.reference ?? '' };
        }));
        this.step.set(2); this.pending.dirty.set(true); this.loading.set(false);
      }, error: (error) => { if (version !== this.revision) return; this.error.set(apiError(error)); this.loading.set(false); }
    });
  }

  protected review(): void {
    if (this.loading() || this.saving()) return;
    this.error.set(null);
    if (this.validPayments()) this.step.set(3);
  }

  protected back(): void { if (!this.saving()) { this.step.update((step) => Math.max(1, step - 1)); this.error.set(null); } }

  protected payments(): EnrollmentPaymentRequest[] {
    return this.lines().filter((line) => Number(line.amount) > 0).map((line) => ({ feeId: line.fee.id, amount: Number(line.amount), paymentMethodCode: line.method,
      ...(line.reference.trim() ? { reference: line.reference.trim() } : {}) }));
  }

  protected validPayments(): boolean {
    const lines = this.lines();
    for (const line of lines) {
      const amount = Number(line.amount);
      if (!Number.isFinite(amount) || amount < 0 || amount > line.balance || (amount > 0 && (!/^\d{1,10}(?:\.\d{1,2})?$/.test(String(amount)) || !this.methods().some((method) => method.code === line.method))) || line.reference.trim().length > 120) {
        this.error.set('Vérifiez les montants (deux décimales maximum, sans dépasser les soldes), les moyens de paiement et les références.'); return false;
      }
    }
    const payments = this.payments();
    if (payments.length > 100) { this.error.set('Une inscription accepte au maximum 100 versements.'); return false; }
    if (payments.length && !this.canPay()) { this.error.set('Votre compte doit disposer de la permission d’encaisser les paiements pour valider cette inscription.'); return false; }
    const unpaid = lines.filter((line) => Math.round(Number(line.amount) * 100) < Math.round(line.balance * 100));
    if ((!this.acceptAdvance && unpaid.length) || (this.acceptAdvance && unpaid.length && !payments.length && !lines.some((line) => line.previouslyPaid > 0))) {
      this.error.set('Réglez tous les soldes ou acceptez explicitement une avance avec au moins un versement positif.'); return false;
    }
    return true;
  }

  protected confirm(): void {
    if (this.step() !== 3 || this.saving() || this.loading() || !this.validPayments()) return;
    this.saving.set(true); this.pending.saving.set(true); this.error.set(null); this.unpaidFeeIds.set([]);
    this.api.createEnrollment(this.establishmentId(), this.academicYearId(), { studentId: this.studentId, schoolClassId: this.schoolClassId,
      classroomId: this.classroomId, acceptAdvance: this.acceptAdvance, payments: this.payments() }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { this.saving.set(false); this.pending.saving.set(false); })).subscribe({
      next: (enrollment) => { this.pending.dirty.set(false); this.pending.saving.set(false); this.saving.set(false); this.studentId = ''; this.schoolClassId = ''; this.classroomId = ''; this.rooms.set([]); this.lines.set([]); this.step.set(1); this.created.emit(enrollment); },
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof HttpErrorResponse && error.error?.code === 'ENROLLMENT_PAYMENT_REQUIRED') {
          this.unpaidFeeIds.set(Array.isArray(error.error.unpaidFeeIds) ? error.error.unpaidFeeIds.filter((id: unknown): id is string => typeof id === 'string') : []);
          this.step.set(2);
          this.error.set('Le règlement requis n’est pas satisfait. Aucun paiement ni inscription de cette tentative n’a été conservé. Corrigez et renvoyez l’ensemble des versements.');
        } else this.error.set(error instanceof HttpErrorResponse && error.status === 409
          ? 'Inscription déjà existante, salle complète ou conflit de règlement. Vérifiez les capacités, les inscriptions et les montants avant de réessayer.' : apiError(error));
      }
    });
  }

  protected studentName(): string { const student = this.students().find((item) => item.id === this.studentId); return student ? `${student.firstName} ${student.lastName}` : ''; }
  protected roomOccupancy(roomId: string): number { return this.enrollments().filter((enrollment) => enrollment.classroomId === roomId).length; }
  protected roomFull(room: Classroom): boolean { return this.roomOccupancy(room.id) >= room.maxStudents; }
  protected methodName(code: string): string { return this.methods().find((method) => method.code === code)?.name ?? code; }
  protected className(): string { return this.classes().find((item) => item.id === this.schoolClassId)?.name ?? ''; }
  protected roomName(): string { return this.rooms().find((item) => item.id === this.classroomId)?.name ?? ''; }
}
