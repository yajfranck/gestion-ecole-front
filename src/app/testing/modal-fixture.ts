import { ComponentFixture } from '@angular/core/testing';

export function openFormModal(fixture: ComponentFixture<unknown>, title: string): void {
  const trigger = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-form-modal > div > button'))
    .find(button => button.textContent?.trim() === title) as HTMLButtonElement | undefined;
  if (!trigger) throw new Error(`Bouton de formulaire introuvable : ${title}`);
  trigger.click();
  fixture.detectChanges();
}
