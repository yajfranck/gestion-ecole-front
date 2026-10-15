import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { WorkspaceContextService } from '../workspace-context.service';

@Component({
  selector: 'app-authenticated-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './authenticated-layout.component.html',
  styleUrl: './authenticated-layout.component.css'
})
export class AuthenticatedLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly workspaceContext = inject(WorkspaceContextService);
  protected readonly workspace = this.workspaceContext.current;

  protected logout(): void {
    this.workspaceContext.clear();
    this.authService.logout();
  }
}