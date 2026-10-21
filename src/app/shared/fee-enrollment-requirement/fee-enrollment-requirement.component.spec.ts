import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FeeEnrollmentRequirementComponent } from './fee-enrollment-requirement.component';

describe('FeeEnrollmentRequirementComponent', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [FeeEnrollmentRequirementComponent],
      providers: [provideZonelessChangeDetection()],
    }),
  );
  it('affiche les frais historiques comme obligatoires puis réagit au caractère facultatif', () => {
    const fixture = TestBed.createComponent(FeeEnrollmentRequirementComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Obligatoire à l’inscription');
    fixture.componentRef.setInput('requiredForEnrollment', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Facultatif à l’inscription');
    fixture.componentRef.setInput('requiredForEnrollment', undefined);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Obligatoire à l’inscription');
  });
});
