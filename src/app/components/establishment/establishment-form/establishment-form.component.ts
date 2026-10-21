import { Component, input, output } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { OnboardEstablishmentRequest } from '../../../models/establishment/establishment.model';

@Component({
  selector: 'app-establishment-form',
  imports: [FormsModule],
  templateUrl: './establishment-form.component.html',
  styleUrl: './establishment-form.component.css'
})
export class EstablishmentFormComponent {
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly submitted = output<OnboardEstablishmentRequest>();
  readonly cancelled = output<void>();

  protected code = '';
  protected name = '';
  protected administratorEmployeeNumber = '';
  protected administratorFirstName = '';
  protected administratorLastName = '';
  protected administratorEmail = '';

  protected submit(form: NgForm): void {
    if (form.invalid || this.busy()) return;
    this.submitted.emit({
      code: this.code.trim(),
      name: this.name.trim(),
      administrator: {
        employeeNumber: this.administratorEmployeeNumber.trim(),
        firstName: this.administratorFirstName.trim(),
        lastName: this.administratorLastName.trim(),
        email: this.administratorEmail.trim()
      }
    });
  }
}
