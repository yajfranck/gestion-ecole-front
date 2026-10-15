import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';

interface NavItem {
  label: string;
  path: string[];
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-establishment-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './establishment-nav.component.html',
  styleUrl: './establishment-nav.component.css'
})
export class EstablishmentNavComponent {
  private readonly router = inject(Router);
  private readonly workspaceContext = inject(WorkspaceContextService);

  readonly establishmentId = input.required<string>();

  protected readonly academicYears = this.workspaceContext.academicYears;
  protected readonly selectedYear = computed(() => {
    const year = this.workspaceContext.academicYear();
    return year?.establishmentId === this.establishmentId() ? year : null;
  });

  protected readonly establishmentGroups: NavGroup[] = [
    { label: 'Établissement', items: [{ label: 'Configuration', path: [], exact: true }] },
    {
      label: 'Administration',
      items: [
        { label: 'Personnel', path: ['team', 'employees'] },
        { label: 'Postes', path: ['team', 'positions'] },
        { label: 'Rôles', path: ['team', 'roles'] },
        { label: 'Permissions', path: ['team', 'permissions'] }
      ]
    },
    {
      label: 'Référentiels et dossiers',
      items: [
        { label: 'Élèves', path: ['students'] },
        { label: 'Matières et niveaux', path: ['referentials'] }
      ]
    }
  ];

  protected readonly yearItems: NavItem[] = [
    { label: 'Classes', path: ['classes'] },
    { label: 'Inscriptions', path: ['enrollments'] },
    { label: 'Calendrier', path: ['calendar'] },
    { label: 'Finances', path: ['finance'] }
  ];

  protected establishmentLink(item: NavItem): string[] {
    return ['/establishments', this.establishmentId(), ...item.path];
  }

  protected yearLink(item: NavItem): string[] {
    return ['/establishments', this.establishmentId(), 'school-years', this.selectedYear()?.id ?? '', ...item.path];
  }

  protected onYearChange(academicYearId: string): void {
    const year = this.academicYears().find((item) => item.id === academicYearId);
    if (!year) return;

    this.workspaceContext.selectAcademicYear(year);
    const section = /\/school-years\/[^/]+\/([^/?#]+)/.exec(this.router.url)?.[1];
    if (section) {
      void this.router.navigate(['/establishments', this.establishmentId(), 'school-years', year.id, section]);
    }
  }
}
