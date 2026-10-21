import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { FormControl, FormsModule, Validators } from '@angular/forms';
import { LucidePencil, LucidePlus, LucideTrash2 } from '@lucide/angular';
import { Guardian, LinkGuardianRequest } from '../../../models/guardian/guardian.model';

interface GuardianRow {
  key: string;
  value: LinkGuardianRequest;
  guardian: Guardian | null;
  editing: boolean;
}

@Component({
  selector: 'app-guardian-form',
  imports: [FormsModule, LucidePencil, LucidePlus, LucideTrash2],
  templateUrl: './guardian-form.component.html',
  styleUrl: './guardian-form.component.css'
})
export class GuardianFormComponent {
  readonly guardians = input<Guardian[]>([]);
  readonly initialValues = input<LinkGuardianRequest[]>([]);
  readonly disabled = input(false);
  readonly canLink = input(false);
  readonly canUnlink = input(false);
  readonly embedded = input(false);
  readonly submitted = output<LinkGuardianRequest[]>();
  readonly removeRequested = output<Guardian>();
  readonly draftsChanged = output<void>();
  protected readonly error = signal<string | null>(null);
  private readonly drafts = signal<GuardianRow[]>([]);
  private nextId = 0;
  protected readonly rows = computed<GuardianRow[]>(() => [
    ...this.guardians().map(guardian => ({ key: `saved-${guardian.id}`, value: guardian, guardian, editing: false })),
    ...this.drafts()
  ]);
  protected readonly draftCount = computed(() => this.drafts().length);

  constructor() {
    effect(() => {
      const initial = this.initialValues();
      untracked(() => {
        const registered = new Set(this.guardians().map(guardian => guardian.email.trim().toLowerCase()));
        const values = initial.filter(value => this.hasContent(value) && !registered.has(value.email.trim().toLowerCase()));
        this.drafts.set((values.length ? values : !this.guardians().length && this.canLink() ? [{ firstName: '', lastName: '', email: '' }] : [])
          .map(value => this.row(value)));
      });
    });
  }

  snapshot(): LinkGuardianRequest[] { return this.drafts().map(row => ({ ...row.value })); }

  accept(guardian: Guardian): void {
    const email = guardian.email.trim().toLowerCase();
    this.drafts.update(rows => rows.filter(row => row.value.email.trim().toLowerCase() !== email));
    this.draftsChanged.emit();
  }

  protected add(): void {
    if (this.disabled() || !this.canLink() || this.drafts().length >= 100) return;
    this.drafts.update(rows => [...rows.map(row => ({ ...row, editing: this.valid(row.value) ? false : row.editing })), this.row({ firstName: '', lastName: '', email: '' })]);
    this.draftsChanged.emit();
  }

  protected edit(row: GuardianRow): void {
    if (this.disabled() || row.guardian || !this.canLink()) return;
    this.drafts.update(rows => rows.map(item => item.key === row.key ? { ...item, editing: true } : item));
  }

  protected change(row: GuardianRow, field: keyof LinkGuardianRequest, value: string): void {
    if (this.disabled() || row.guardian || !row.editing || !this.canLink()) return;
    row.value[field] = value;
    this.error.set(null);
    this.draftsChanged.emit();
  }

  protected remove(row: GuardianRow): void {
    if (this.disabled()) return;
    if (row.guardian) {
      if (this.canUnlink()) this.removeRequested.emit(row.guardian);
    } else if (this.canLink()) {
      this.drafts.update(rows => rows.filter(item => item.key !== row.key));
      this.error.set(null);
      this.draftsChanged.emit();
    }
  }

  submit(): void {
    if (this.disabled()) return;
    const requests = this.snapshot().filter(value => this.hasContent(value)).map(value => ({ firstName: value.firstName.trim(), lastName: value.lastName.trim(), email: value.email.trim().toLowerCase() }));
    this.error.set(null);
    if (!requests.length && !this.guardians().length) { this.error.set('Renseignez au moins un tuteur.'); return; }
    if (requests.length && !this.canLink()) { this.error.set('Votre compte ne permet pas d’enregistrer ces tuteurs.'); return; }
    if (requests.some(value => !this.valid(value))) { this.error.set('Vérifiez le prénom, le nom (100 caractères maximum chacun) et l’adresse e-mail (254 caractères maximum).'); return; }
    const emails = [...this.guardians().map(value => value.email.trim().toLowerCase()), ...requests.map(value => value.email)];
    if (new Set(emails).size !== emails.length) { this.error.set('Chaque tuteur doit avoir une adresse e-mail différente.'); return; }
    this.submitted.emit(requests);
  }

  private row(value: LinkGuardianRequest): GuardianRow { return { key: `draft-${this.nextId++}`, value: { ...value }, guardian: null, editing: true }; }
  private hasContent(value: LinkGuardianRequest): boolean { return !!(value.firstName.trim() || value.lastName.trim() || value.email.trim()); }
  private valid(value: LinkGuardianRequest): boolean {
    return !!value.firstName.trim() && value.firstName.trim().length <= 100 && !!value.lastName.trim() && value.lastName.trim().length <= 100
      && !!value.email.trim() && value.email.trim().length <= 254 && !Validators.email(new FormControl(value.email.trim()));
  }
}
