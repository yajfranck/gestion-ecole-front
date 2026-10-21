import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Employee } from '../../../models/employee/employee.model';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { EmployeeService } from '../../../service/employee-service/employee.service';

@Component({
  selector: 'app-employee-detail',
  imports: [RouterLink],
  templateUrl: './employee-detail.component.html',
  styleUrl: './employee-detail.component.css'
})
export class EmployeeDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly employeeService = inject(EmployeeService);
  private readonly context = inject(WorkspaceContextService);

  protected readonly isSelf = this.route.snapshot.data?.['self'] === true;
  protected readonly establishmentId = signal('');
  protected readonly employee = signal<Employee | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.establishmentId.set(
      this.route.parent?.snapshot.paramMap.get('establishmentId') ?? this.route.snapshot.paramMap.get('establishmentId') ?? this.context.current()?.establishmentId ?? ''
    );
    this.load();
  }

  protected load(): void {
    if (!this.establishmentId()) { this.isLoading.set(false); this.errorMessage.set('Sélectionnez un établissement pour consulter votre profil.'); return; }
    if (!this.establishmentId()) {
      this.isLoading.set(false);
      this.errorMessage.set('Sélectionnez un établissement pour consulter votre fiche de personnel.');
      return;
    }
    const employeeId = this.route.snapshot.paramMap.get('employeeId');
    if (!this.isSelf && !employeeId) {
      this.isLoading.set(false);
      this.errorMessage.set('Fiche de personnel introuvable.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    const call = this.isSelf ? this.employeeService.getMe(this.establishmentId()) : this.employeeService.getEmployee(this.establishmentId(), employeeId ?? '');
    call.subscribe({
      next: (employee) => {
        this.employee.set(employee);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.errorFor(error));
        this.isLoading.set(false);
      }
    });
  }

  private errorFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'Votre compte ne dispose pas de l’autorisation nécessaire pour consulter cette fiche.';
      if (error.status === 404) return 'Cette fiche est absente ou hors de votre périmètre.';
    }
    return 'Impossible de charger la fiche. Vérifiez le serveur puis réessayez.';
  }
}
