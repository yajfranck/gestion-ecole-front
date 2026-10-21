import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, of, Subscription } from 'rxjs';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { Student } from '../../../models/student/student.model';
import { StudentService } from '../../../service/student-service/student.service';
import { apiError } from '../../../shared/api-error';
import { DialogComponent } from '../../../shared/dialog/dialog.component';
import { StudentGuardiansComponent } from '../student-guardians/student-guardians.component';

@Component({
  selector: 'app-student-list',
  imports: [FormsModule, DialogComponent, StudentGuardiansComponent],
  templateUrl: './student-list.component.html',
  styleUrl: './student-list.component.css'
})
export class StudentListComponent {
  protected readonly access = inject(WorkspaceAccessService);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(StudentService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private revision = 0;
  private requestedStudentId: string | null = null;
  private readonly params = toSignal(combineLatest([
    this.route.paramMap ?? of(this.route.snapshot.paramMap),
    this.route.queryParamMap ?? of(this.route.snapshot.queryParamMap)
  ]));
  protected readonly establishmentId = signal('');
  protected readonly students = signal<Student[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly searchTerm = signal('');
  protected readonly selectedStudent = signal<Student | null>(null);
  protected profileTrigger: HTMLElement | null = null;
  protected readonly filteredStudents = computed(() => {
    const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr');
    const search = normalize(this.searchTerm().trim());
    return this.students().filter(student => !search || normalize(`${student.firstName} ${student.lastName} ${student.studentNumber}`).includes(search));
  });

  constructor() {
    effect(() => {
      const params = this.params();
      if (!params) return;
      untracked(() => {
        this.establishmentId.set(params[0].get('establishmentId') ?? '');
        this.requestedStudentId = params[1].get('studentId') ?? params[0].get('studentId');
        this.selectedStudent.set(null);
        this.searchTerm.set('');
        this.load();
      });
    });
  }

  protected load(): void {
    const version = ++this.revision;
    this.request?.unsubscribe();
    this.isLoading.set(true);
    this.loadError.set(null);
    if (!this.access.hasPermission('can_student_read', this.establishmentId())) { this.isLoading.set(false); return; }
    this.request = this.api.getStudents(this.establishmentId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: students => {
        if (version !== this.revision) return;
        this.students.set(students.filter(student => student.enabled && student.establishmentId === this.establishmentId()));
        this.isLoading.set(false);
        if (this.requestedStudentId) {
          this.selectedStudent.set(this.students().find(student => student.id === this.requestedStudentId) ?? null);
          this.requestedStudentId = null;
        }
      },
      error: error => { if (version === this.revision) { this.loadError.set(apiError(error)); this.isLoading.set(false); } }
    });
  }

  protected openProfile(student: Student, event: Event): void {
    this.profileTrigger = event.currentTarget as HTMLElement;
    this.selectedStudent.set(student);
  }
}
