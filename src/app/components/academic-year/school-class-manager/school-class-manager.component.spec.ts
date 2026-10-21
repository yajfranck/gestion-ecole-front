import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';
import { environment } from '../../../../environments/environment';
import { SchoolClassManagerComponent } from './school-class-manager.component';

describe('SchoolClassManagerComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [SchoolClassManagerComponent],
    providers: [providePermissionFixture(['can_school_class_create', 'can_school_class_read', 'can_school_class_update', 'can_school_class_delete']), provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
  }));

  it('affiche les classes avec leurs actions', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();

    http.expectOne(`${base}/school-years/year-1/classes`).flush([
      { id: 'c-1', establishmentId: 'school-1', academicYearId: 'year-1', code: 'P1-A', name: 'Primary 1 A', enabled: true }
    ]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Primary 1 A');
    expect(text).toContain('Détails');
    expect(text).toContain('Archiver');
    expect(text).toContain('Nouvelle classe');
    expect((fixture.nativeElement as HTMLElement).querySelector('#new-class-code')).toBeNull();
    expect(text).not.toContain('Niveau');
    http.verify();
  });

  it('filtre les classes par série sans modifier la liste source', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();
    http.expectOne(`${base}/school-years/year-1/classes`).flush([
      { id: 'c-1', establishmentId: 'school-1', academicYearId: 'year-1', code: 'T-S', name: 'Terminale S', series: 'Scientifique', enabled: true },
      { id: 'c-2', establishmentId: 'school-1', academicYearId: 'year-1', code: 'T-L', name: 'Terminale L', series: 'Littéraire', enabled: true }
    ]);

    fixture.componentInstance['selectedSeries'].set('Littéraire');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Terminale L');
    expect(text).not.toContain('Terminale S');
    expect(fixture.componentInstance['classes']()).toHaveSize(2);
    http.verify();
  });

  it('ne réutilise pas une permission accordée dans un autre établissement', () => {
    TestBed.overrideProvider(WorkspaceAccessService, { useValue: {
      hasPermission: (permission: string, establishmentId: string) => establishmentId === 'other-school'
        && ['can_school_class_read', 'can_school_class_create'].includes(permission)
    } });
    const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('consultation de cette liste n’est pas autorisée');
    expect(text).not.toContain('Nouvelle classe');
    TestBed.inject(HttpTestingController).verify();
  });

  it('ouvre le formulaire sans salle, puis actualise la liste après création', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();
    const url = `${base}/school-years/year-1/classes`;
    http.expectOne(url).flush([]);
    const component = fixture.componentInstance;
    component['openCreate']();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('app-school-class-form')).not.toBeNull();
    expect(element.querySelector('#new-class-code')).not.toBeNull();
    expect(element.querySelector('#new-classroom-code')).toBeNull();

    component['onCreated']([{ id: 'class', establishmentId: 'school-1', academicYearId: 'year-1', code: 'T-S', name: 'Terminale', enabled: true }]);
    http.expectOne(url).flush([]);
    expect(component['createOpen']()).toBeFalse();
    expect(component['successMessage']()).toContain('Ajoutez ses salles');
    http.verify();
  });

  it('préremplit la modification et permet de retirer la série depuis le formulaire', async () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SchoolClassManagerComponent);
    fixture.componentRef.setInput('establishmentId', 'school-1');
    fixture.componentRef.setInput('academicYearId', 'year-1');
    fixture.detectChanges();
    const url = `${base}/school-years/year-1/classes`;
    const schoolClass = { id: 'class', establishmentId: 'school-1', academicYearId: 'year-1', code: 'T-S', name: 'Terminale', series: 'Scientifique', enabled: true };
    http.expectOne(url).flush([schoolClass]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const edit = [...element.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Modifier')!;
    edit.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const form = element.querySelector('dialog form')!;
    const fields = [...form.querySelectorAll('input')];
    expect(fields.map(field => field.value)).toEqual(['T-S', 'Terminale', 'Scientifique']);
    fields[2].value = '';
    fields[2].dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const update = http.expectOne(`${url}/class`);
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ code: 'T-S', name: 'Terminale', series: '' });
    update.flush({});
    http.expectOne(url).flush([]);
    http.verify();
  });
});
