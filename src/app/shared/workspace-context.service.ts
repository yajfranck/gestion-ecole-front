import { Injectable, signal } from '@angular/core';
import { AcademicYear } from '../models/academic-year/academic-year.model';
import { Establishment } from '../models/establishment/establishment.model';

export interface WorkspaceContext {
  establishmentId: string;
  establishmentName: string;
  academicYearId: string | null;
  academicYearName: string | null;
}

export type AcademicWorkspaceStep = 'setup' | 'students' | 'enrollments' | 'finance' | 'calendar' | 'catalog';

@Injectable({ providedIn: 'root' })
export class WorkspaceContextService {
  readonly current = signal<WorkspaceContext | null>(null);
  readonly academicYears = signal<AcademicYear[]>([]);
  readonly activeAcademicStep = signal<AcademicWorkspaceStep>('setup');

  selectEstablishment(establishment: Establishment): void {
    const current = this.current();
    const sameEstablishment = current?.establishmentId === establishment.id;
    if (!sameEstablishment) {
      this.academicYears.set([]);
      this.activeAcademicStep.set('setup');
    }
    this.current.set({
      establishmentId: establishment.id,
      establishmentName: establishment.name,
      academicYearId: sameEstablishment ? current.academicYearId : null,
      academicYearName: sameEstablishment ? current.academicYearName : null
    });
  }

  selectAcademicYear(year: AcademicYear): void {
    const current = this.current();
    if (!current || current.establishmentId !== year.establishmentId) {
      return;
    }

    if (current.academicYearId !== year.id) this.activeAcademicStep.set('setup');
    this.current.set({
      ...current,
      academicYearId: year.id,
      academicYearName: year.name
    });
  }

  selectCurrentAcademicYear(years: AcademicYear[], today = new Date()): AcademicYear | null {
    this.setAcademicYears(years);
    const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    const currentYear = years.find((year) =>
      year.enabled && year.startsOn <= todayKey && year.endsOn >= todayKey
    ) ?? null;

    if (currentYear) {
      this.selectAcademicYear(currentYear);
    } else {
      this.clearAcademicYear();
    }

    return currentYear;
  }

  setAcademicYears(years: AcademicYear[]): void {
    const current = this.current();
    this.academicYears.set(current
      ? years.filter((year) => year.establishmentId === current.establishmentId && year.enabled)
      : []);
  }

  setAcademicStep(step: AcademicWorkspaceStep): void {
    this.activeAcademicStep.set(step);
  }

  clearAcademicYear(): void {
    this.activeAcademicStep.set('setup');
    const current = this.current();
    if (current) {
      this.current.set({
        ...current,
        academicYearId: null,
        academicYearName: null
      });
    }
  }

  clear(): void {
    this.current.set(null);
    this.academicYears.set([]);
    this.activeAcademicStep.set('setup');
  }
}