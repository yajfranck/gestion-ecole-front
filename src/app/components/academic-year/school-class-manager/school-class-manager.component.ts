import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  readonly initialClassId = input<string | null>(null);

  protected readonly classes = signal<SchoolClass[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly archivingId = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected code = '';
  protected name = '';
  protected series = '';
  protected newCode = '';
  protected newName = '';
  protected newSeries = '';
  protected newClassroomCode = '';
  protected newClassroomName = '';
  protected newClassroomMaxStudents: number | null = null;
  protected readonly isCreating = signal(false);
  protected readonly createError = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.academicYearService.getClasses(this.establishmentId(), this.academicYearId()).subscribe({
      next: (classes) => {
        this.classes.set(classes);
        const initial = this.initialClassId();
        if (initial && this.expandedId() === null && classes.some((item) => item.id === initial)) {
          this.expandedId.set(initial);
        }
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(this.errorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  protected create(): void {
    const code = this.newCode.trim();
    const name = this.newName.trim();
    const classroomCode = this.newClassroomCode.trim().toUpperCase();
    const classroomName = this.newClassroomName.trim();
    const maxStudents = Number(this.newClassroomMaxStudents);
    if (!code || !name || !classroomCode || !classroomName || this.newClassroomMaxStudents === null || this.isCreating()) return;
    if (code.length > 40 || name.length > 100 || this.newSeries.trim().length > 100 || classroomCode.length > 40 || classroomName.length > 100 || !Number.isInteger(maxStudents) || maxStudents < 1) {
      this.createError.set('Vérifiez le code, le nom et la série de la classe, puis le code, le nom et la capacité positive de la première salle.');
      return;
    }

    this.isCreating.set(true);
    this.createError.set(null);
    this.successMessage.set(null);
    this.academicYearService.createClass(this.establishmentId(), this.academicYearId(), {
      code, name, series: this.newSeries.trim() || null,
      classrooms: [{ code: classroomCode, name: classroomName, maxStudents }]
    }).subscribe({
      next: () => {
        this.newCode = '';
        this.newName = '';
        this.newSeries = '';
        this.newClassroomCode = '';
        this.newClassroomName = '';
        this.newClassroomMaxStudents = null;
        this.isCreating.set(false);
        this.successMessage.set(`La classe « ${name} » et sa première salle ont été créées.`);
        this.load();
      },
      error: (error: unknown) => {
        this.createError.set(this.errorMessage(error));
        this.isCreating.set(false);
      }
    });
  }

  protected toggleDetail(schoolClass: SchoolClass): void {
    this.expandedId.set(this.expandedId() === schoolClass.id ? null : schoolClass.id);
  }

  protected startEditing(schoolClass: SchoolClass): void {
    this.editingId.set(schoolClass.id);
    this.code = schoolClass.code;
    this.name = schoolClass.name;
    this.series = schoolClass.series ?? '';
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
    if (!code || !name || this.isSaving()) return;
    if (code.length > 40 || name.length > 100 || this.series.trim().length > 100) { this.actionError.set('Vérifiez le code, le nom et la série de la classe.'); return; }

    this.isSaving.set(true);
    this.actionError.set(null);
    this.academicYearService.updateClass(this.establishmentId(), this.academicYearId(), schoolClass.id, { code, name, series: this.series.trim() }).subscribe({
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

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Vérifiez les champs de la classe et de sa première salle, notamment la capacité qui doit être un entier positif.';
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
      if (error.status === 404) return 'Cette classe ou cette année scolaire est absente ou inaccessible.';
      if (error.status === 409) return 'Le code de classe existe déjà dans cette année ou un code de salle est dupliqué dans la demande.';
    }
    return 'Impossible de traiter les classes. Vérifiez le serveur puis réessayez.';
  }
}
