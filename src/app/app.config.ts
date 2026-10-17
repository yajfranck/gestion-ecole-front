import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withRouterConfig } from '@angular/router';

import { authInterceptor } from './core/auth.interceptor';
import { routes } from './app.routes';
import { licenseInterceptor } from './core/license.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withInterceptors([authInterceptor, licenseInterceptor])),
    provideRouter(routes, withRouterConfig({ paramsInheritanceStrategy: 'always' }))
  ]
};
