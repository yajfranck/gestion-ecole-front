import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { GuardianChild } from '../../../models/guardian/guardian.model';
import { GuardianService } from '../../../service/guardian-service/guardian.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-guardian-children',
  imports: [RouterLink],
  templateUrl: './guardian-children.component.html',
  styleUrl: './guardian-children.component.css'
})
export class GuardianChildrenComponent implements OnInit {
  private readonly guardianService = inject(GuardianService);

  protected readonly children = signal<GuardianChild[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.guardianService.getMyChildren().subscribe({
      next: (children) => {
        this.children.set(children);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.errorMessage.set(error instanceof HttpErrorResponse && error.status === 403
          ? 'Cet espace est réservé aux comptes parents et tuteurs.'
          : 'Impossible de charger vos enfants. Vérifiez le serveur puis réessayez.');
        this.isLoading.set(false);
      }
    });
  }
}
