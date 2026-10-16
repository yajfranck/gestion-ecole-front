import { afterNextRender, Component, computed, effect, ElementRef, HostListener, inject, Injector, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LucideChevronDown } from '@lucide/angular';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';

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
  imports: [RouterLink, RouterLinkActive, LucideChevronDown],
  templateUrl: './establishment-nav.component.html',
  styleUrl: './establishment-nav.component.css'
})
export class EstablishmentNavComponent {
  private readonly router = inject(Router);
  private readonly workspaceContext = inject(WorkspaceContextService);
  private readonly access = inject(WorkspaceAccessService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly currentUrl = signal(this.router.url);

  readonly establishmentId = input.required<string>();
  protected readonly openGroup = signal<string | null>(null);
  protected readonly compactOpen = signal(false);

  protected readonly academicYears = this.workspaceContext.academicYears;
  protected readonly selectedYear = computed(() => {
    const year = this.workspaceContext.academicYear();
    return year?.establishmentId === this.establishmentId() ? year : null;
  });

  protected readonly establishmentGroups: NavGroup[] = [
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
        { label: 'Matières', path: ['referentials'] }
      ]
    }
  ];

  protected readonly yearItems = computed<NavItem[]>(() => [
    { label: 'Classes', path: ['classes'] },
    { label: 'Inscriptions', path: ['enrollments'] },
    ...(this.access.hasPermission('can_attendance_read', this.establishmentId())
      ? [{ label: 'Présences et absences', path: ['attendance'] }] : []),
    { label: 'Calendrier', path: ['calendar'] },
    { label: 'Finances', path: ['finance'] }
  ]);

  constructor() {
    effect(() => {
      this.establishmentId();
      this.close();
    });
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects);
        this.close();
      }
    });
  }

  protected groupActive(items: NavItem[], annual = false): boolean {
    this.currentUrl();
    return items.some((item) => this.router.isActive(
      this.router.createUrlTree(annual ? this.yearLink(item) : this.establishmentLink(item)),
      { paths: item.exact ? 'exact' : 'subset', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' }
    ));
  }

  protected toggleGroup(group: string): void {
    this.openGroup.update((current) => current === group ? null : group);
  }

  protected close(): void {
    this.openGroup.set(null);
    this.compactOpen.set(false);
  }

  protected onTriggerKey(event: KeyboardEvent, group: string, panel: HTMLElement): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    this.openGroup.set(group);
    afterNextRender(() => {
      const controls = this.panelControls(panel);
      (event.key === 'ArrowUp' ? controls.at(-1) : controls[0])?.focus();
    }, { injector: this.injector });
  }

  protected onPanelKey(event: KeyboardEvent, panel: HTMLElement): void {
    if (!(event.target instanceof HTMLAnchorElement)) return;
    const controls = this.panelControls(panel);
    const index = controls.indexOf(event.target);
    let next: number;
    switch (event.key) {
      case 'ArrowDown': next = (index + 1) % controls.length; break;
      case 'ArrowUp': next = (index - 1 + controls.length) % controls.length; break;
      case 'Home': next = 0; break;
      case 'End': next = controls.length - 1; break;
      default: return;
    }
    event.preventDefault();
    controls[next]?.focus();
  }

  @HostListener('document:click', ['$event'])
  @HostListener('document:focusin', ['$event'])
  protected onOutside(event: Event): void {
    if (event.target instanceof Node && !this.element.nativeElement.contains(event.target)) this.close();
  }

  @HostListener('keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (!this.openGroup() && !this.compactOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    const active = this.element.nativeElement.querySelector<HTMLButtonElement>('.group-trigger[aria-expanded="true"]');
    if (active) {
      this.openGroup.set(null);
      active.focus();
    } else {
      this.close();
      this.element.nativeElement.querySelector<HTMLButtonElement>('.compact-trigger')?.focus();
    }
  }

  private panelControls(panel: HTMLElement): HTMLElement[] {
    return Array.from(panel.querySelectorAll<HTMLElement>('a[href], select'));
  }

  protected establishmentLink(item: NavItem): string[] {
    return ['/establishments', this.establishmentId(), ...item.path];
  }

  protected yearLink(item: NavItem): string[] {
    return ['/establishments', this.establishmentId(), 'school-years', this.selectedYear()?.id ?? '', ...item.path];
  }

  protected onYearChange(academicYearId: string, select?: HTMLSelectElement): void {
    const year = this.academicYears().find((item) => item.id === academicYearId);
    if (!year) return;

    const section = /\/school-years\/[^/]+\/([^/?#]+)/.exec(this.router.url)?.[1];
    if (section) {
      void this.router.navigate(['/establishments', this.establishmentId(), 'school-years', year.id, section]).then((navigated) => {
        if (!navigated && select) select.value = this.selectedYear()?.id ?? '';
      });
    } else {
      this.workspaceContext.selectAcademicYear(year);
    }
  }
}
