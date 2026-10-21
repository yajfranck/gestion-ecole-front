import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormRowsComponent } from './form-rows.component';

@Component({ imports: [FormRowsComponent], template: '<app-form-rows [headings]="[\'Code\', \'Nom\', \'Capacité\']" layout="triple"><input aria-label="Code"><input aria-label="Nom"><input aria-label="Capacité"><button>Retirer</button></app-form-rows>' })
class HostComponent {}

describe('FormRowsComponent', () => {
  it('partage un en-tête et garde les champs projetés dans une grille défilante', () => {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.grid input').length).toBe(3);
    expect(root.querySelectorAll('.grid > .form-label').length).toBe(3);
    expect(root.querySelector('.overflow-x-auto')).not.toBeNull();
    expect(root.querySelector('.grid button')?.textContent).toBe('Retirer');
  });
});
