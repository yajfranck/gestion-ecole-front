import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AssignLicenseRequest, LicenseEvent, LicenseOffer, PlatformLicense } from '../../models/license/license.model';

@Injectable({ providedIn: 'root' })
export class LicenseService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  list(establishmentId: string) {
    return this.http.get<PlatformLicense[]>(`${this.api}/establishments/${establishmentId}/license`);
  }

  offers() {
    return this.http.get<LicenseOffer[]>(`${this.api}/admin/license-offers`);
  }

  assign(establishmentId: string, request: AssignLicenseRequest) {
    return this.http.post<PlatformLicense>(this.base(establishmentId), request);
  }

  transition(establishmentId: string, licenseId: number, action: 'suspend' | 'reactivate' | 'end') {
    return this.http.post<PlatformLicense>(`${this.base(establishmentId)}/${licenseId}/${action}`, {});
  }

  events(establishmentId: string, licenseId: number) {
    return this.http.get<LicenseEvent[]>(`${this.base(establishmentId)}/${licenseId}/events`);
  }

  private base(establishmentId: string) {
    return `${this.api}/admin/establishments/${establishmentId}/licenses`;
  }
}