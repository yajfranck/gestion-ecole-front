import { Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';

@Component({
  selector: 'app-establishment-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './establishment-nav.component.html',
  styleUrl: './establishment-nav.component.css'
})
export class EstablishmentNavComponent {
  private readonly workspaceContext = inject(WorkspaceContextService);

  readonly establishmentId = input.required<string>();
  protected readonly workspace = this.workspaceContext.current;
  protected readonly academicYears = this.workspaceContext.academicYears;

  protected openAcademicYear(year: AcademicYear): void {
    this.workspaceContext.selectAcademicYear(year);
    this.workspaceContext.setAcademicStep('setup');
  }
}
