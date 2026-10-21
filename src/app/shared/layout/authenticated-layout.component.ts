import { FEATURE_PERMISSIONS } from '../../core/feature-permissions';
import { PermissionDirective } from '../permission/permission.directive';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { WorkspaceAccessService } from '../../core/workspace-access.service';
import { AuthService } from '../../core/auth.service';
import { WorkspaceContextService } from '../workspace-context.service';
import { PendingChangesService } from '../pending-changes.service';
import { EstablishmentNavComponent } from '../../components/establishment/establishment-nav/establishment-nav.component';
import { LicenseAccessService } from '../../core/license-access.service';

@Component({
  selector: 'app-authenticated-layout',
  imports: [PermissionDirective, RouterLink, RouterLinkActive, RouterOutlet, EstablishmentNavComponent],
  templateUrl: './authenticated-layout.component.html',
  styleUrl: './authenticated-layout.component.css'
})
export class AuthenticatedLayoutComponent {
  protected readonly features = FEATURE_PERMISSIONS;
  protected readonly access = inject(WorkspaceAccessService);
  protected readonly licenseAccess = inject(LicenseAccessService);
  private readonly authService = inject(AuthService);
  private readonly workspaceContext = inject(WorkspaceContextService);
  private readonly pending = inject(PendingChangesService);
  protected readonly workspace = this.workspaceContext.current;

  protected logout(): void {
    if (!this.pending.confirmLeave(() => this.logout())) return;
    this.workspaceContext.clear();
    this.authService.logout();
  }
}
