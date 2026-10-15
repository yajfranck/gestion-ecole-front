import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { GuardianChildrenComponent } from './guardian-children.component';

describe('GuardianChildrenComponent', () => {
  const url = `${environment.apiUrl}/guardians/me/children`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [GuardianChildrenComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
  }));

  it('affiche les enfants liés au compte', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(GuardianChildrenComponent);
    fixture.detectChanges();
    http.expectOne(url).flush([{ id: 'st-1', establishmentId: 'school-1', studentNumber: 'STU-00000001', firstName: 'Ada', lastName: 'Lovelace' }]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ada Lovelace');
    http.verify();
  });

  it('signale un accès refusé', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(GuardianChildrenComponent);
    fixture.detectChanges();
    http.expectOne(url).flush(null, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('réservé aux comptes parents');
    http.verify();
  });
});
