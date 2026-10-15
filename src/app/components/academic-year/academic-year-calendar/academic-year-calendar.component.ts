import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { AcademicPeriodListComponent } from '../academic-period-list/academic-period-list.component';
import { AcademicYearSettingsComponent } from '../academic-year-settings/academic-year-settings.component';

@Component({
  selector: 'app-academic-year-calendar',
  imports: [AcademicYearSettingsComponent, AcademicPeriodListComponent],
  templateUrl: './academic-year-calendar.component.html',
  styleUrl: './academic-year-calendar.component.css'
})
export class AcademicYearCalendarComponent {
  private readonly router = inject(Router);
  private readonly workspaceContext = inject(WorkspaceContextService);

  protected readonly workspace = this.workspaceContext.current;
  protected readonly year = this.workspaceContext.academicYear;

  protected onYearUpdated(year: AcademicYear): void {
    this.workspaceContext.academicYears.update((years) => years.map((item) => item.id === year.id ? year : item));
    this.workspaceContext.selectAcademicYear(year);
  }

  protected onYearArchived(): void {
    const establishmentId = this.workspace()?.establishmentId;
    const archivedId = this.year()?.id;
    this.workspaceContext.academicYears.update((years) => years.filter((item) => item.id !== archivedId));
    this.workspaceContext.clearAcademicYear();
    void this.router.navigate(['/establishments', establishmentId]);
  }
}
