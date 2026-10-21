import { Injectable, signal } from '@angular/core';
import { AcademicYear } from '../models/academic-year/academic-year.model';
import { Establishment } from '../models/establishment/establishment.model';

export interface WorkspaceContext {
  establishmentId: string;
  establishmentName: string;
  academicYearId: string | null;
  academicYearName: string | null;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceContextService {
  readonly current = signal<WorkspaceContext | null>(null);
  readonly academicYearsLoaded = signal(false);
  readonly academicYears = signal<AcademicYear[]>([]);
  readonly academicYear = signal<AcademicYear | null>(null);

  selectEstablishment(establishment: Pick<Establishment, 'id' | 'name'> & Partial<Establishment>): void {
    const current = this.current();
    const sameEstablishment = current?.establishmentId === establishment.id;
    if (!sameEstablishment) {
      this.academicYears.set([]);
      this.academicYearsLoaded.set(false);
      this.academicYear.set(null);
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

    this.academicYear.set(year);
    this.current.set({
      ...current,
      academicYearId: year.id,
      academicYearName: year.name
    });
  }

  selectCurrentAcademicYear(years: AcademicYear[], today = new Date()): AcademicYear | null {
    this.setAcademicYears(years);
    const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    const previous = this.academicYears().find((year) => year.id === this.current()?.academicYearId);
    const currentYear = previous ?? this.academicYears().find((year) =>
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
    this.academicYearsLoaded.set(true);
    const current = this.current();
    this.academicYears.set(current
      ? years.filter((year) => year.establishmentId === current.establishmentId && year.enabled)
      : []);
  }

  clearAcademicYear(): void {
    this.academicYear.set(null);
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
    this.academicYearsLoaded.set(false);
    this.academicYear.set(null);
  }
}
