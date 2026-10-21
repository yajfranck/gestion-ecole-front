import { providePermissionFixture } from '../../../testing/permission-fixture';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { EstablishmentReferentialsComponent } from './establishment-referentials.component';

describe('EstablishmentReferentialsComponent', () => {
  const base = `${environment.apiUrl}/establishments/school-1`;

  beforeEach(() => TestBed.configureTestingModule({
    imports: [EstablishmentReferentialsComponent],
    providers: [providePermissionFixture(['can_subject_read']), 
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ establishmentId: 'school-1' }) } } }
    ]
  }));

  it('affiche les matières propres à l’établissement, sans appel aux niveaux supprimés', () => {
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EstablishmentReferentialsComponent);
    fixture.detectChanges();
    http.expectOne(`${base}/subjects`).flush([]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Matières');
    expect(text).not.toContain('Niveau');
    http.verify();
  });
});
