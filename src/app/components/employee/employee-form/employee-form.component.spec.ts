import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmployeeFormComponent } from './employee-form.component';

describe('EmployeeFormComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [EmployeeFormComponent],
    providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
  }));

  it('creates the employee invitation form', () => {
    const fixture = TestBed.createComponent(EmployeeFormComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Inviter un membre du personnel');
  });
});