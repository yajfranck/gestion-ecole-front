import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionRequirement, WorkspaceAccessService } from '../../core/workspace-access.service';
import { WorkspaceContextService } from '../workspace-context.service';

/** Affichage uniquement : le serveur contrôle chaque action et son périmètre. */
@Directive({ selector: '[appPermission]' })
export class PermissionDirective {
  private readonly access = inject(WorkspaceAccessService);
  private readonly context = inject(WorkspaceContextService);
  private readonly template = inject(TemplateRef);
  private readonly container = inject(ViewContainerRef);
  readonly appPermission = input.required<PermissionRequirement>();
  readonly appPermissionGlobal = input(false);
  readonly appPermissionPlatform = input(false);
  readonly appPermissionEstablishment = input<string>();
  private visible = false;

  constructor() {
    effect(() => {
      const permission = this.appPermission();
      const id = this.appPermissionEstablishment() ?? this.context.current()?.establishmentId;
      const allowed = this.appPermissionPlatform()
        ? this.access.allowsPlatform(permission)
        : this.appPermissionGlobal() || !id
          ? this.access.allows(permission) : this.access.allows(permission, id);
      if (allowed === this.visible) return;
      this.visible = allowed;
      this.container.clear();
      if (allowed) this.container.createEmbeddedView(this.template);
    });
  }
}
