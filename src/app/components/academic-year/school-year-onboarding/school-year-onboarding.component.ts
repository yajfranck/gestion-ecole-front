import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AcademicYearFormComponent } from '../academic-year-form/academic-year-form.component';
import { SchoolYearOnboardingService } from '../../../core/school-year-onboarding.service';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';

@Component({
  selector: 'app-school-year-onboarding',
  imports: [FormModalComponent, AcademicYearFormComponent, RouterLink],
  templateUrl: './school-year-onboarding.component.html',
  styleUrl: './school-year-onboarding.component.css',
})
export class SchoolYearOnboardingComponent implements OnInit {
  protected readonly onboarding = inject(SchoolYearOnboardingService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.check();
  }
  protected check(force = false): void {
    if (!this.onboarding.canConfigureSchoolYear()) {
      void this.router.navigateByUrl('/establishments', { replaceUrl: true });
      return;
    }
    this.onboarding
      .ensure(force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        if (status === 'ready') this.continue();
      });
  }
  protected onCreated(year: AcademicYear): void {
    if (this.onboarding.complete(year) && this.onboarding.status() === 'ready') this.continue();
  }
  private continue(): void {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    const destination =
      requested?.startsWith('/') && !requested.startsWith('//') && !requested.startsWith('/setup/')
        ? requested
        : '/establishments';
    void this.router.navigateByUrl(destination, { replaceUrl: true });
  }
}
