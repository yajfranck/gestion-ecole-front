import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ChangePasswordComponent } from './change-password.component';

describe('ChangePasswordComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [ChangePasswordComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([])
    ]
  }));

  it('renders the password change form', () => {
    expect(TestBed.createComponent(ChangePasswordComponent)).toBeTruthy();
  });

  it('does not send a request when the confirmation differs', () => {
    const fixture = TestBed.createComponent(ChangePasswordComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
      submit(): void;
    };
    component.currentPassword = 'current-password';
    component.newPassword = 'secure-new-password';
    component.confirmPassword = 'different-password';
    component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('La confirmation ne correspond pas');
    http.expectNone((request) => request.url.endsWith('/user/me/password'));
    http.verify();
  });
});