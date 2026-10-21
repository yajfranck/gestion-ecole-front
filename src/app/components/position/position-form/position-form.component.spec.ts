import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PositionFormComponent } from './position-form.component';

describe('PositionFormComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [PositionFormComponent],
    providers: [providePermissionFixture(['can_position_create', 'can_role_read']), provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
  }));

  it('creates the position form', () => {
    const fixture = TestBed.createComponent(PositionFormComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nouveau poste');
  });

  it('shows active custom roles and excludes roles reserved from positions', () => {
    const fixture = TestBed.createComponent(PositionFormComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('roles', [
      { establishmentId: null, code: 'STAFF', name: 'Personnel', description: null, enabled: true, editable: false, permissions: [] },
      { establishmentId: 'school-1', code: 'SCHOOL_LIBRARIAN', name: 'Bibliothécaire', description: null, enabled: true, editable: true, permissions: [] },
      { establishmentId: null, code: 'ADMIN', name: 'Administration plateforme', description: null, enabled: true, editable: false, permissions: [] },
      { establishmentId: null, code: 'PARENT', name: 'Parent', description: null, enabled: true, editable: false, permissions: [] },
      { establishmentId: 'school-1', code: 'DISABLED_ROLE', name: 'Rôle désactivé', description: null, enabled: false, editable: true, permissions: [] }
    ]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Personnel');
    expect(text).toContain('Bibliothécaire');
    expect(text).not.toContain('Administration plateforme');
    expect(text).not.toContain('Parent');
    expect(text).not.toContain('Rôle désactivé');
  });
});