import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RoleFormComponent } from './role-form.component';

describe('RoleFormComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [RoleFormComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
  }));

  it('creates a role form', () => {
    const fixture = TestBed.createComponent(RoleFormComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    expect(fixture).toBeTruthy();
  });

  it('filters permissions without clearing selections hidden by the search', () => {
    const fixture = TestBed.createComponent(RoleFormComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/establishments/school-1/permissions')).flush([
      { code: 'can_student_read', description: 'Consulter les élèves.' },
      { code: 'can_enrollment_read', description: 'Consulter les inscriptions.' }
    ]);
    fixture.detectChanges();

    const studentCheckbox = fixture.nativeElement.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement;
    studentCheckbox.checked = true;
    studentCheckbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'inscriptions';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]').length).toBe(2);

    search.value = '';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]').length).toBe(3);
    expect((fixture.nativeElement.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement).checked).toBeTrue();

    http.verify();
  });

  it('selects and clears only the permissions currently displayed', () => {
    const fixture = TestBed.createComponent(RoleFormComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/establishments/school-1/permissions')).flush([
      { code: 'can_student_read', description: 'Consulter les élèves.' },
      { code: 'can_enrollment_read', description: 'Consulter les inscriptions.' },
      { code: 'can_enrollment_create', description: 'Créer une inscription.' }
    ]);
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    const studentCheckbox = fixture.nativeElement.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement;
    studentCheckbox.checked = true;
    studentCheckbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    search.value = 'enrollment';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    let checkboxes = [...fixture.nativeElement.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    const selectDisplayed = checkboxes[0];
    selectDisplayed.checked = true;
    selectDisplayed.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    checkboxes = [...fixture.nativeElement.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(checkboxes.length).toBe(3);
    expect(checkboxes.slice(1).every((checkbox) => checkbox.checked)).toBeTrue();

    checkboxes[0].checked = false;
    checkboxes[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    checkboxes = [...fixture.nativeElement.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(checkboxes.slice(1).every((checkbox) => !checkbox.checked)).toBeTrue();

    search.value = '';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    checkboxes = [...fixture.nativeElement.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    expect(checkboxes.length).toBe(4);
    expect(checkboxes[0].indeterminate).toBeTrue();
    expect(checkboxes[1].checked).toBeTrue();
    expect(checkboxes.slice(2).every((checkbox) => !checkbox.checked)).toBeTrue();

    http.verify();
  });
});