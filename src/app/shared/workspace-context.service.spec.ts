import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AcademicYear } from '../models/academic-year/academic-year.model';
import { Establishment } from '../models/establishment/establishment.model';
import { WorkspaceContextService } from './workspace-context.service';

describe('WorkspaceContextService', () => {
  let service: WorkspaceContextService;

  const northSchool: Establishment = {
    id: 'school-1', code: 'NORTH', name: 'École du Nord', enabled: true, createdAt: '', updatedAt: ''
  };
  const southSchool: Establishment = {
    id: 'school-2', code: 'SOUTH', name: 'École du Sud', enabled: true, createdAt: '', updatedAt: ''
  };
  const schoolYear: AcademicYear = {
    id: 'year-1', establishmentId: 'school-1', name: '2026-2027',
    startsOn: '2026-09-01', endsOn: '2027-06-30', enabled: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), WorkspaceContextService]
    });
    service = TestBed.inject(WorkspaceContextService);
  });

  it('keeps the year with its establishment and clears it when switching establishments', () => {
    service.selectEstablishment(northSchool);
    service.selectAcademicYear(schoolYear);
    expect(service.current()?.academicYearName).toBe('2026-2027');

    service.selectEstablishment(southSchool);
    expect(service.current()).toEqual({
      establishmentId: 'school-2',
      establishmentName: 'École du Sud',
      academicYearId: null,
      academicYearName: null
    });
  });

  it('selects the enabled school year containing today', () => {
    service.selectEstablishment(northSchool);
    const pastYear: AcademicYear = {
      ...schoolYear,
      id: 'year-past',
      name: '2025-2026',
      startsOn: '2025-09-01',
      endsOn: '2026-06-30'
    };
    const currentYear = { ...schoolYear, startsOn: '2026-09-01', endsOn: '2027-06-30' };

    expect(service.selectCurrentAcademicYear([pastYear, currentYear], new Date(2026, 9, 15))).toEqual(currentYear);
    expect(service.current()?.academicYearId).toBe('year-1');
    expect(service.current()?.academicYearName).toBe('2026-2027');
  });
});
