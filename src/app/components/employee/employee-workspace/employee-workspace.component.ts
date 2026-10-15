import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { EstablishmentNavComponent } from '../../establishment/establishment-nav/establishment-nav.component';

@Component({
  selector: 'app-employee-workspace',
  imports: [RouterLink, RouterOutlet, EstablishmentNavComponent],
  templateUrl: './employee-workspace.component.html',
  styleUrl: './employee-workspace.component.css'
})
export class EmployeeWorkspaceComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly establishmentId = signal('');

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.establishmentId.set(params.get('establishmentId') ?? '');
    });
  }
}