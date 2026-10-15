export interface AcademicPeriod {
  id: string;
  academicYearId: string;
  name: string;
  startsOn: string;
  endsOn: string;
}

export type AcademicPeriodRequest = Pick<AcademicPeriod, 'name' | 'startsOn' | 'endsOn'>;
