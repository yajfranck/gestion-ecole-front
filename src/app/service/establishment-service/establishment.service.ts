import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Establishment,
  EstablishmentOnboardingResponse,
  OnboardEstablishmentRequest
} from '../../models/establishment/establishment.model';

@Injectable({ providedIn: 'root' })
export class EstablishmentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getAccessible(): Observable<Establishment[]> {
    return this.http.get<Establishment[]>(`${this.apiUrl}/establishments`);
  }

  update(establishmentId: string, request: Partial<Pick<Establishment, 'code' | 'name'>>): Observable<Establishment> {
    return this.http.patch<Establishment>(`${this.apiUrl}/establishments/${establishmentId}`, request);
  }

  create(request: OnboardEstablishmentRequest): Observable<EstablishmentOnboardingResponse> {
    return this.http.post<EstablishmentOnboardingResponse>(`${this.apiUrl}/establishments`, request);
  }

  deactivate(establishmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/establishments/${establishmentId}`);
  }
}
