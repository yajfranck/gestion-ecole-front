import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { SubjectListComponent } from './subject-list.component';

describe('SubjectListComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/subjects`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [SubjectListComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
  }));

  function create() {
    const fixture = TestBed.createComponent(SubjectListComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.detectChanges();
    return fixture;
  }

  it('affiche les matières de l’établissement', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = create();
    http.expectOne(url).flush([{ id: 's-1', establishmentId: 'school-1', code: 'MATH', name: 'Mathematics', enabled: true }]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Mathematics');
    http.verify();
  });

  it('indique l’absence de matière', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = create();
    http.expectOne(url).flush([]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucune matière');
    http.verify();
  });

  it('affiche un formulaire de création ouvert, avec champs obligatoires marqués et action principale', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = create();
    http.expectOne(url).flush([]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('details')?.open).toBeTrue();
    expect(root.querySelectorAll('.form-label.is-required').length).toBe(2);
    expect(root.querySelector('button.btn-primary')?.textContent?.trim()).toBe('Créer la matière');
    expect(root.querySelector('button.btn-secondary')).toBeNull();
    http.verify();
  });

  it('distingue la modification : badge, Annuler secondaire et Enregistrer principal', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = create();
    http.expectOne(url).flush([{ id: 's-1', establishmentId: 'school-1', code: 'MATH', name: 'Mathematics', enabled: true }]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('details')?.open).toBeFalse();

    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Modifier')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('details')?.open).toBeTrue();
    expect(root.querySelector('.form-mode')?.textContent).toContain('Modification');
    expect(root.querySelector('button.btn-secondary')?.textContent?.trim()).toBe('Annuler');
    expect(root.querySelector('button.btn-primary')?.textContent?.trim()).toBe('Enregistrer');
    expect((root.querySelector('#subject-name') as HTMLInputElement).value).toBe('Mathematics');
    http.verify();
  });
});
