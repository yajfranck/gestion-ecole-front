import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucidePlus } from '@lucide/angular';
import { Subject } from '../../../models/subject/subject.model';
import { SubjectService } from '../../../service/subject-service/subject.service';

@Component({
  selector: 'app-subject-list',
  imports: [FormsModule, LucidePlus],
  templateUrl: './subject-list.component.html',
  styleUrl: './subject-list.component.css'
})
export class SubjectListComponent implements OnInit {
  private readonly subjectService = inject(SubjectService);

  readonly establishmentId = input.required<string>();

  protected readonly subjects = signal<Subject[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly archivingId = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected code = '';
  protected name = '';

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.subjectService.getSubjects(this.establishmentId()).subscribe({
      next: (subjects) => {
        this.subjects.set(subjects);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(this.errorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  protected startEditing(subject: Subject): void {
    this.editingId.set(subject.id);
    this.code = subject.code;
    this.name = subject.name;
    this.formError.set(null);
    this.successMessage.set(null);
  }

  protected cancelEditing(): void {
    this.editingId.set(null);
    this.code = '';
    this.name = '';
    this.formError.set(null);
  }

  protected save(): void {
    const code = this.code.trim();
    const name = this.name.trim();
    if (!code || !name || this.isSaving()) return;

    const editingId = this.editingId();
    const request = { code, name };
    const call = editingId
      ? this.subjectService.updateSubject(this.establishmentId(), editingId, request)
      : this.subjectService.createSubject(this.establishmentId(), request);

    this.isSaving.set(true);
    this.formError.set(null);
    this.successMessage.set(null);
    call.subscribe({
      next: () => {
        this.successMessage.set(editingId ? `La matière « ${name} » a été modifiée.` : `La matière « ${name} » a été créée.`);
        this.editingId.set(null);
        this.code = '';
        this.name = '';
        this.isSaving.set(false);
        this.load();
      },
      error: (error: unknown) => {
        this.formError.set(this.errorMessage(error));
        this.isSaving.set(false);
      }
    });
  }

  protected archive(subject: Subject): void {
    if (this.archivingId() || !window.confirm(`Archiver la matière « ${subject.name} » ?`)) return;

    this.archivingId.set(subject.id);
    this.formError.set(null);
    this.successMessage.set(null);
    this.subjectService.archiveSubject(this.establishmentId(), subject.id).subscribe({
      next: () => {
        this.archivingId.set(null);
        if (this.editingId() === subject.id) this.cancelEditing();
        this.successMessage.set(`La matière « ${subject.name} » a été archivée.`);
        this.load();
      },
      error: (error: unknown) => {
        this.formError.set(this.errorMessage(error, true));
        this.archivingId.set(null);
      }
    });
  }

  private errorMessage(error: unknown, archiving = false): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Vérifiez le code et le nom de la matière.';
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'Cette matière est absente ou inaccessible.';
      if (error.status === 409) {
        return archiving
          ? 'Cette matière est utilisée par une classe active : retirez-la d’abord de ces classes.'
          : 'Ce code de matière existe déjà.';
      }
    }
    return 'Impossible de traiter les matières. Vérifiez le serveur puis réessayez.';
  }
}
