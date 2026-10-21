import { Component, computed, input } from '@angular/core';
import { feeRequiresEnrollmentPayment } from '../tuition';

@Component({
  selector: 'app-fee-enrollment-requirement',
  templateUrl: './fee-enrollment-requirement.component.html',
  styleUrl: './fee-enrollment-requirement.component.css',
})
export class FeeEnrollmentRequirementComponent {
  readonly requiredForEnrollment = input<boolean | undefined>(true);
  protected readonly required = computed(() =>
    feeRequiresEnrollmentPayment({ requiredForEnrollment: this.requiredForEnrollment() }),
  );
}
