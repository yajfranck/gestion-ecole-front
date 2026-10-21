import { openFormModal } from '../../../testing/modal-fixture';
import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { SubjectListComponent } from './subject-list.component';
import { ToastService } from '../../../service/toast-service/toast.service';

describe('SubjectListComponent', () => {
  const url = `${environment.apiUrl}/establishments/school-1/subjects`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [SubjectListComponent],
    providers: [providePermissionFixture(['can_subject_create', 'can_subject_read', 'can_subject_update', 'can_subject_delete'], ['school', 'school-1', 'other-school']), provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
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

  it('ouvre la création en modale, avec champs obligatoires marqués et action principale', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = create();
    http.expectOne(url).flush([]);
    fixture.detectChanges();
    openFormModal(fixture, 'Ajouter ou modifier la matière');
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('dialog')).toBeTruthy();
    expect(root.querySelector<HTMLInputElement>('#subject-name')!.required).toBeTrue();
    expect(root.querySelector<HTMLInputElement>('#subject-code')!.required).toBeFalse();
    expect(root.querySelector('dialog button[type="submit"]')?.textContent?.trim()).toBe('Créer la matière');
    expect(root.querySelector('dialog [aria-label="Fermer la fenêtre"]')).toBeTruthy();
    http.verify();
  });

  it('distingue la modification : badge, Annuler secondaire et Enregistrer principal', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = create();
    http.expectOne(url).flush([{ id: 's-1', establishmentId: 'school-1', code: 'MATH', name: 'Mathematics', enabled: true }]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('dialog')).toBeNull();

    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Modifier')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('dialog')).toBeTruthy();
    expect(root.querySelector('.form-mode')?.textContent).toContain('Modification');
    expect(root.querySelector('dialog .form-actions button.btn-secondary')?.textContent?.trim()).toBe('Annuler');
    expect(root.querySelector('dialog button[type="submit"]')?.textContent?.trim()).toBe('Enregistrer');
    expect((root.querySelector('#subject-name') as HTMLInputElement).value).toBe('Mathematics');
    http.verify();
  });

  for (const successful of [true, false]) {
    it(successful ? 'confirme la création par un toast et ferme la modale' : 'signale le refus par un toast et conserve la saisie', async () => {
      const http = TestBed.inject(HttpTestingController);
      const fixture = create();
      http.expectOne(url).flush([]);
      fixture.detectChanges();
      openFormModal(fixture, 'Ajouter ou modifier la matière');
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      for (const [selector, value] of [['#subject-name', 'Mathématiques'], ['#subject-code', 'MATH']]) {
        const input = root.querySelector<HTMLInputElement>(selector)!;
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await fixture.whenStable();
      root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      if (successful) {
        const request = http.expectOne(url);
        expect(request.request.body).toEqual({ subjects: [{ name: 'Mathématiques', code: 'MATH' }] });
        request.flush([{ id: 's-1', name: 'Mathématiques', code: 'MATH', enabled: true }]);
        http.expectOne(url).flush([]);
      } else {
        http.expectOne(url).flush({}, { status: 409, statusText: 'Conflict' });
      }
      fixture.detectChanges();
      await fixture.whenStable();
      const notifications = TestBed.inject(ToastService).notifications();
      expect(notifications).toHaveSize(1);
      expect(notifications[0].type).toBe(successful ? 'success' : 'error');
      if (successful) expect(root.querySelector('dialog')).toBeNull();
      else expect(root.querySelector<HTMLInputElement>('#subject-name')!.value).toBe('Mathématiques');
      http.verify();
    });
  }
});
