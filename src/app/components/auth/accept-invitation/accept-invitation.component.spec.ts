import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AcceptInvitationComponent } from './accept-invitation.component';

describe('AcceptInvitationComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [AcceptInvitationComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { fragment: 'token=invite-token' } } }
    ]
  }));

  it('shows the password setup form when the invitation token is present', () => {
    const fixture = TestBed.createComponent(AcceptInvitationComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Activez votre compte');
    expect(fixture.nativeElement.querySelector('#invitation-password')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#invitation-password-confirm')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('absent ou invalide');
  });
});