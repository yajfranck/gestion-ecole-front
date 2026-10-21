import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { WorkspaceAccessService } from './workspace-access.service';
import { permissionInterceptor } from './permission.interceptor';

describe('permissionInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  const notice = signal<string | null>(null);
  let permissions: string[];
  let platformPermissions: string[];

  beforeEach(() => {
    permissions = [];
    platformPermissions = [];
    notice.set(null);
    TestBed.configureTestingModule({ providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(withInterceptors([permissionInterceptor])),
      provideHttpClientTesting(),
      { provide: WorkspaceAccessService, useValue: {
        notice,
        hasPlatformPermission: (permission: string) => platformPermissions.includes(permission),
        hasAllPermissions: (requested: string[]) => requested.length > 0 && requested.every((permission) => permissions.includes(permission))
      } }
    ] });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });

  afterEach(() => http.verify());

  it('bloque un endpoint plateforme sans scope, même si la permission est présente', () => {
    permissions = ['can_dashboard_read'];
    let received: unknown;
    client.get(`${environment.apiUrl}/dashboard`).subscribe({ error: (error) => received = error });

    expect(received instanceof HttpErrorResponse && received.status).toBe(403);
    expect(notice()).toContain('Accès refusé');
    http.expectNone(`${environment.apiUrl}/dashboard`);
  });

  it('ne demande pas le scope plateforme pour le catalogue générique des permissions', () => {
    permissions = ['can_permission_read'];
    client.get(`${environment.apiUrl}/permission`).subscribe();

    http.expectOne(`${environment.apiUrl}/permission`).flush([]);
    expect(notice()).toBeNull();
  });

  it('laisse le backend contrôler la création d’établissement', () => {
    const url = `${environment.apiUrl}/establishments`;
    client.post(url, {}).subscribe();

    http.expectOne(url).flush({});
    expect(notice()).toBeNull();
  });

  it('laisse passer les opérations de licence avec leurs permissions sans scope plateforme', () => {
    permissions = ['can_license_offer_read', 'can_license_assign'];
    const offersUrl = `${environment.apiUrl}/admin/license-offers`;
    const assignUrl = `${environment.apiUrl}/admin/establishments/school-1/licenses`;

    client.get(offersUrl).subscribe();
    http.expectOne(offersUrl).flush([]);
    client.post(assignUrl, { offerId: 'offer-1' }).subscribe();
    http.expectOne(assignUrl).flush({ id: 1 });

    expect(notice()).toBeNull();
  });

  it('protège la création par lot avec la permission de création des classes', () => {
    const url = `${environment.apiUrl}/establishments/school-1/school-years/year-1/classes/bulk`;
    let received: unknown;
    client.post(url, { classes: [] }).subscribe({ error: (error) => received = error });
    expect(received instanceof HttpErrorResponse && received.status).toBe(403);
    http.expectNone(url);

    permissions = ['can_school_class_create'];
    client.post(url, { classes: [] }).subscribe();
    http.expectOne(url).flush([]);
  });

  it('signale un 403 serveur sans le convertir en déconnexion ou autre statut', () => {
    permissions = ['can_permission_read'];
    let received: unknown;
    client.get(`${environment.apiUrl}/permission`).subscribe({ error: (error) => received = error });
    http.expectOne(`${environment.apiUrl}/permission`).flush({}, { status: 403, statusText: 'Forbidden' });

    expect(received instanceof HttpErrorResponse && received.status).toBe(403);
    expect(notice()).toContain('Accès refusé');
  });
});
