import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AcceptGuardianInvitationRequest,
  Guardian,
  GuardianChild,
  GuardianLink,
  LinkGuardianRequest
} from '../../models/guardian/guardian.model';

@Injectable({ providedIn: 'root' })
export class GuardianService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getGuardians(establishmentId: string, studentId: string): Observable<Guardian[]> {
    return this.http.get<Guardian[]>(this.url(establishmentId, studentId));
  }

  linkGuardian(establishmentId: string, studentId: string, request: LinkGuardianRequest): Observable<GuardianLink> {
    return this.http.post<GuardianLink>(this.url(establishmentId, studentId), request);
  }

  unlinkGuardian(establishmentId: string, studentId: string, guardianId: string): Observable<void> {
    return this.http.delete<void>(`${this.url(establishmentId, studentId)}/${guardianId}`);
  }

  acceptInvitation(request: AcceptGuardianInvitationRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/guardians/invitations/accept`, request);
  }

  getMyChildren(): Observable<GuardianChild[]> {
    return this.http.get<GuardianChild[]>(`${this.apiUrl}/guardians/me/children`);
  }

  private url(establishmentId: string, studentId: string): string {
    return `${this.apiUrl}/establishments/${establishmentId}/students/${studentId}/guardians`;
  }
}
