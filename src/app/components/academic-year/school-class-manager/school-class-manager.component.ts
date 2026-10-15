import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GradeLevel } from '../../../models/grade-level/grade-level.model';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { SchoolClassDetailComponent } from '../school-class-detail/school-class-detail.component';

@Component({
  selector: 'app-school-class-manager',
  imports: [FormsModule, SchoolClassDetailComponent],
  templateUrl: './school-class-manager.component.html',
  styleUrl: './school-class-manager.component.css'
})
export class SchoolClassManagerComponent implements OnInit {
  private readonly academicYearService = inject(AcademicYearService);

  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();

  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly levels = signal<GradeLevel[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly archivingId = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected gradeLevelId = '';
  protected code = '';
  protected name = '';

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.academicYearService.getGradeLevels(this.establishmentId()).subscribe({
      next: (levels) => {
        this.levels.set(levels);
        this.academicYearService.getClasses(this.establishmentId(), this.academicYearId()).subscribe({
          next: (classes) => {
            this.classes.set(classes);
            this.isLoading.set(false);
          },
          error: (error: unknown) => this.failLoad(error)
        });
      },
      error: (error: unknown) => this.failLoad(error)
    });
  }

  protected levelNameFor(gradeLevelId: string): string {
    return this.levels().find((level) => level.id === gradeLevelId)?.name ?? 'Niveau';
  }

  protected toggleDetail(schoolClass: SchoolClass): void {
    this.expandedId.set(this.expandedId() === schoolClass.id ? null : schoolClass.id);
  }

  protected startEditing(schoolClass: SchoolClass): void {
    this.editingId.set(schoolClass.id);
    this.gradeLevelId = schoolClass.gradeLevelId;
    this.code = schoolClass.code;
    this.name = schoolClass.name;
    this.actionError.set(null);
    this.successMessage.set(null);
  }

  protected cancelEditing(): void {
    this.editingId.set(null);
    this.actionError.set(null);
  }

  protected save(schoolClass: SchoolClass): void {
    const code = this.code.trim();
    const name = this.name.trim();
    if (!this.gradeLevelId || !code || !name || this.isSaving()) return;

    this.isSaving.set(true);
    this.actionError.set(null);
    this.academicYearService.updateClass(this.establishmentId(), this.academicYearId(), schoolClass.id, {
      gradeLevelId: this.gradeLevelId,
      code,
      name
    }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.editingId.set(null);
        this.successMessage.set(`La classe « ${name} » a été modifiée.`);
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error));
        this.isSaving.set(false);
      }
    });
  }

  protected archive(schoolClass: SchoolClass): void {
    if (this.archivingId() || !window.confirm(`Archiver la classe « ${schoolClass.name} » ?`)) return;

    this.archivingId.set(schoolClass.id);
    this.actionError.set(null);
    this.successMessage.set(null);
    this.academicYearService.archiveClass(this.establishmentId(), this.academicYearId(), schoolClass.id).subscribe({
      next: () => {
        this.archivingId.set(null);
        if (this.expandedId() === schoolClass.id) this.expandedId.set(null);
        this.successMessage.set(`La classe « ${schoolClass.name} » a été archivée.`);
        this.load();
      },
      error: (error: unknown) => {
        this.actionError.set(this.errorMessage(error));
        this.archivingId.set(null);
      }
    });
  }

  private failLoad(error: unknown): void {
    this.loadError.set(this.errorMessage(error));
    this.isLoading.set(false);
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Vérifiez le niveau, le code et le nom de la classe.';
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'Cette classe ou ce niveau est absent ou inaccessible.';
      if (error.status === 409) return 'Ce code ou ce nom de classe existe déjà pour cette année.';
    }
    return 'Impossible de traiter les classes. Vérifiez le serveur puis réessayez.';
  }
}
