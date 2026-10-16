import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { WorkspaceContextService } from '../workspace-context.service';
import { PendingChangesService } from '../pending-changes.service';
import { EstablishmentNavComponent } from '../../components/establishment/establishment-nav/establishment-nav.component';

@Component({
  selector: 'app-authenticated-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, EstablishmentNavComponent],
  templateUrl: './authenticated-layout.component.html',
  styleUrl: './authenticated-layout.component.css'
})
export class AuthenticatedLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly workspaceContext = inject(WorkspaceContextService);
  private readonly pending = inject(PendingChangesService);
  protected readonly workspace = this.workspaceContext.current;

  protected logout(): void {
    if (!this.pending.confirmLeave()) return;
    this.workspaceContext.clear();
    this.authService.logout();
  }
}