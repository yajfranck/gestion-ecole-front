import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { WorkspaceAccessService } from './workspace-access.service';
import { AuthService } from './auth.service';
import { map } from 'rxjs';

export const permissionGuard: CanActivateChildFn = (route) => {
  const access = inject(WorkspaceAccessService);
  const router = inject(Router);
  const auth = inject(AuthService);
  const decide = () => {
    const id = route.pathFromRoot.map((part) => part.paramMap.get('establishmentId')).find(Boolean) ?? undefined;
    const allowed = route.pathFromRoot.concat(route).every((part) => {
      const data = part.data ?? {};
      const requirement = data['permissionRule'] ?? data['permissions'];
      if (!requirement) return true;
      return data['platformPermissions'] === true
        ? access.allowsPlatform(requirement)
        : access.allows(requirement, data['globalPermissions'] ? undefined : id);
    });
    return allowed || router.createUrlTree(['/access-denied']);
  };
  return auth.restoring?.() ? access.ensurePermissions().pipe(map((ready) => ready ? decide() : router.createUrlTree(['/login']))) : decide();
};
