import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { SchoolClassGridComponent } from './school-class-grid.component';

@Component({
  imports: [FormsModule, SchoolClassGridComponent],
  template: `<form><app-school-class-grid>
    <label>Code<input name="code" [(ngModel)]="code" required></label>
  </app-school-class-grid></form>`
})
class GridHostComponent {
  code = '6A';
}

describe('SchoolClassGridComponent', () => {
  it('conserve la liaison des champs projetés au formulaire parent', async () => {
    TestBed.configureTestingModule({
      imports: [GridHostComponent],
      providers: [provideZonelessChangeDetection()]
    });
    const fixture = TestBed.createComponent(GridHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    expect(input.value).toBe('6A');
    input.value = '6B';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.code).toBe('6B');
  });
});
