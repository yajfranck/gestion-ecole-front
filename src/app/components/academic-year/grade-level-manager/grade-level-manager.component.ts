import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GradeLevel } from '../../../models/grade-level/grade-level.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';

@Component({
  selector: 'app-grade-level-manager',
  imports: [FormsModule],
  templateUrl: './grade-level-manager.component.html',
  styleUrl: './grade-level-manager.component.css'
})
export class GradeLevelManagerComponent implements OnInit {
  private readonly academicYearService = inject(AcademicYearService);

  readonly establishmentId = input.required<string>();

  protected readonly levels = signal<GradeLevel[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly archivingId = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected code = '';
  protected name = '';
  protected displayOrder = 0;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.academicYearService.getGradeLevels(this.establishmentId()).subscribe({
      next: (levels) => {
        this.levels.set(levels);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(this.errorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  protected startEditing(level: GradeLevel): void {
    this.editingId.set(level.id);
    this.code = level.code;
    this.name = level.name;
    this.displayOrder = level.displayOrder;
    this.actionError.set(null);
    this.successMessage.set(null);
  }

  protected cancelEditing(): void {
    this.editingId.set(null);
    this.actionError.set(null);
  }

  protected save(level: GradeLevel): void {
    const code = this.code.trim();
    const name = this.name.trim();
    if (!code || !name || this.isSaving()) return;

    this.isSaving.set(true);
    this.actionError.set(null);
    this.academicYearService.updateGradeLevel(this.establishmentId(), level.id, {
      code,
      name,
      displayOrder: Number(this.displayOrder)
    }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.editingId.set(null);
        this.successMessage.set(`Le niveau « ${name} » a été modifié.`);
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error));
        this.isSaving.set(false);
      }
    });
  }

  protected archive(level: GradeLevel): void {
    if (this.archivingId() || !window.confirm(`Archiver le niveau « ${level.name} » ?`)) return;

    this.archivingId.set(level.id);
    this.actionError.set(null);
    this.successMessage.set(null);
    this.academicYearService.archiveGradeLevel(this.establishmentId(), level.id).subscribe({
      next: () => {
        this.archivingId.set(null);
        this.successMessage.set(`Le niveau « ${level.name} » a été archivé.`);
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error, true));
        this.archivingId.set(null);
      }
    });
  }

  private errorMessage(error: unknown, archiving = false): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'Ce niveau est absent ou inaccessible.';
      if (error.status === 409) {
        return archiving
          ? 'Ce niveau est utilisé par une classe active : archivez ou déplacez d’abord ces classes.'
          : 'Ce code ou ce nom de niveau existe déjà.';
      }
      if (error.status === 400) return 'Vérifiez le code, le nom et l’ordre d’affichage.';
    }
    return 'Impossible de traiter les niveaux. Vérifiez le serveur puis réessayez.';
  }
}
