import { TableActionDirective } from '../../../shared/table-actions/table-action.directive';
import { TableActionsComponent } from '../../../shared/table-actions/table-actions.component';
import { ToastService } from '../../../service/toast-service/toast.service';
import { FormModalComponent } from '../../../shared/form-modal/form-modal.component';
import { PermissionDirective } from '../../../shared/permission/permission.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AcademicYear } from '../../../models/academic-year/academic-year.model';
import { Establishment } from '../../../models/establishment/establishment.model';
import { AcademicYearService } from '../../../service/academic-year-service/academic-year.service';
import { EstablishmentService } from '../../../service/establishment-service/establishment.service';
import { WorkspaceContextService } from '../../../shared/workspace-context.service';
import { WorkspaceAccessService } from '../../../core/workspace-access.service';

@Component({
  selector: 'app-establishment-settings',
  imports: [TableActionDirective, TableActionsComponent, FormModalComponent, PermissionDirective, FormsModule, RouterLink],
  templateUrl: './establishment-settings.component.html',
  styleUrl: './establishment-settings.component.css'
})
export class EstablishmentSettingsComponent implements OnInit {
  private readonly toast = inject(ToastService);

  constructor() {
    this.toast.connect(this.updateSuccess, 'success');
    this.toast.connect(this.createSuccess, 'success');
    this.toast.connect(this.updateError, 'error');
    this.toast.connect(this.createError, 'error');
  }

  private readonly route = inject(ActivatedRoute);
  private readonly academicYearService = inject(AcademicYearService);
  private readonly establishmentService = inject(EstablishmentService);
  private readonly workspaceContext = inject(WorkspaceContextService);
  protected readonly access = inject(WorkspaceAccessService);
  protected readonly editing = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly updateError = signal<string | null>(null);
  protected readonly updateSuccess = signal<string | null>(null);
  protected editCode = '';
  protected editName = '';

  protected readonly workspace = this.workspaceContext.current;
  protected readonly establishmentId = signal('');
  protected readonly years = signal<AcademicYear[]>([]);
  protected readonly establishment = signal<Establishment | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isCreating = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly createError = signal<string | null>(null);
  protected readonly createSuccess = signal<string | null>(null);
  protected name = '';
  protected startsOn = '';
  protected endsOn = '';

  ngOnInit(): void {
    this.establishmentId.set(this.route.snapshot.paramMap.get('establishmentId') ?? '');
    if (this.access.has('can_establishment_read')) this.establishmentService.getAccessible().subscribe({
      next: (establishments) => {
        this.establishment.set(establishments.find((item) => item.id === this.establishmentId()) ?? null);
        if (this.route.snapshot.queryParamMap?.has('edit')) this.edit();
      },
      error: (error: unknown) => this.loadError.set(this.getErrorMessage(error))
    });
    this.load();
  }

  protected load(): void {
    if (!this.access.hasPermission('can_academic_year_read', this.establishmentId())) { this.isLoading.set(false); return; }
    this.isLoading.set(true);
    this.loadError.set(null);
    this.academicYearService.getAcademicYears(this.establishmentId()).subscribe({
      next: (years) => {
        this.years.set(years);
        this.workspaceContext.setAcademicYears(years);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(this.getErrorMessage(error));
        this.isLoading.set(false);
      }
    });
  }

  protected select(year: AcademicYear): void {
    this.workspaceContext.selectAcademicYear(year);
  }

  protected edit(): void {
    const establishment = this.establishment();
    if (!establishment || !this.access.canUpdateEstablishment(establishment.id)) return;
    this.editCode = establishment.code;
    this.editName = establishment.name;
    this.updateError.set(null);
    this.updateSuccess.set(null);
    this.editing.set(true);
  }

  protected saveEstablishment(): void {
    const establishment = this.establishment();
    if (!establishment || this.isSaving() || !this.access.canUpdateEstablishment(establishment.id)) return;
    const code = this.editCode.trim();
    const name = this.editName.trim();
    if (!code || code.length > 40 || !name || name.length > 200) {
      this.updateError.set('Le code est obligatoire (40 caractères maximum), ainsi que le nom (200 caractères maximum).');
      return;
    }
    const request: Partial<Pick<Establishment, 'code' | 'name'>> = {};
    if (code !== establishment.code) request.code = code;
    if (name !== establishment.name) request.name = name;
    if (!Object.keys(request).length) {
      this.editing.set(false);
      return;
    }
    this.isSaving.set(true);
    this.updateError.set(null);
    this.establishmentService.update(establishment.id, request).subscribe({
      next: (updated) => {
        this.establishment.set(updated);
        this.workspaceContext.selectEstablishment(updated);
        this.isSaving.set(false);
        this.editing.set(false);
        this.updateSuccess.set('Établissement modifié.');
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.updateError.set(status === 409 ? 'Ce code est déjà utilisé par un établissement.'
          : status === 403 ? 'Accès refusé : vous ne pouvez pas modifier cet établissement.'
          : status === 400 ? 'Données invalides : vérifiez le code et le nom.'
          : status === 404 ? 'Cet établissement est absent ou désactivé.'
          : 'Impossible de modifier l’établissement. Votre saisie est conservée.');
      }
    });
  }

  protected createAcademicYear(): void {
    if (!this.access.hasPermission('can_academic_year_create', this.establishmentId())) return;
    const name = this.name.trim();
    if (!name || !this.startsOn || !this.endsOn || this.isCreating()) {
      return;
    }

    this.createError.set(null);
    this.createSuccess.set(null);
    if (this.startsOn >= this.endsOn) {
      this.createError.set('La date de fin doit être postérieure à la date de début.');
      return;
    }

    this.isCreating.set(true);
    this.academicYearService.createAcademicYear(this.establishmentId(), {
      name,
      startsOn: this.startsOn,
      endsOn: this.endsOn
    }).subscribe({
      next: () => {
        this.name = '';
        this.startsOn = '';
        this.endsOn = '';
        this.isCreating.set(false);
        this.createSuccess.set(`L’année scolaire « ${name} » a été créée.`);
        this.load();
      },
      error: (error: unknown) => {
        this.createError.set(this.getErrorMessage(error));
        this.isCreating.set(false);
      }
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return 'Votre compte ne dispose pas de l’autorisation nécessaire pour cette opération.';
    }
    if (error instanceof HttpErrorResponse && error.status === 409) {
      return 'Cette année scolaire existe déjà dans cet établissement.';
    }
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return 'Vérifiez le nom et les dates de l’année scolaire.';
    }
    return 'Impossible de charger ou d’enregistrer ces informations. Vérifiez le serveur puis réessayez.';
  }
}
