import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { AccessDeniedComponent } from './access-denied.component';

describe('AccessDeniedComponent', () => {
  it('explique le refus et permet de choisir un établissement', () => {
    TestBed.configureTestingModule({ imports: [AccessDeniedComponent], providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(AccessDeniedComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Accès refusé');
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/establishments');
  });
});
