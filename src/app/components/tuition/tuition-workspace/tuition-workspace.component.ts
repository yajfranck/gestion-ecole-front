import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucidePlus } from '@lucide/angular';
import { SchoolClass } from '../../../models/school-class/school-class.model';
import { Student } from '../../../models/student/student.model';
import {
  CreateTuitionFeeRequest,
  CreateTuitionFeeTypeRequest,
  PaymentReceipt,
  RenamePaymentMethodRequest,
  RenameTuitionFeeTypeRequest,
  StudentFeeCharge,
  TuitionFee,
  TuitionFeeType,
  TuitionPayment,
  TuitionPaymentMethod
} from '../../../models/tuition/tuition.model';
import { TuitionService } from '../../../service/tuition-service/tuition.service';

type FeeScope = 'ACADEMIC_YEAR' | 'SCHOOL_CLASS' | 'STUDENT';
type FinanceView = 'payments' | 'fees' | 'history' | 'settings';

@Component({
  selector: 'app-tuition-workspace',
  standalone: true,
  imports: [FormsModule, DatePipe, LucidePlus],
  templateUrl: './tuition-workspace.component.html',
  styleUrl: './tuition-workspace.component.css'
})
export class TuitionWorkspaceComponent implements OnInit {
  private readonly tuitionService = inject(TuitionService);

  readonly establishmentId = input.required<string>();
  readonly academicYearId = input.required<string>();
  readonly academicYearStartsOn = input('');
  readonly academicYearEndsOn = input('');
  readonly classes = input<SchoolClass[]>([]);
  readonly students = input<Student[]>([]);

  protected readonly activeView = signal<FinanceView>('payments');
  protected readonly paymentMethods = signal<TuitionPaymentMethod[]>([]);
  protected readonly isLoadingMethods = signal(true);
  protected readonly isAddingPaymentMethod = signal(false);
  protected readonly isSavingPaymentMethod = signal(false);
  protected readonly editingPaymentMethodCode = signal<string | null>(null);
  protected readonly isRenamingPaymentMethod = signal(false);
  protected readonly deactivatingPaymentMethodCode = signal<string | null>(null);
  protected readonly methodsError = signal<string | null>(null);
  protected readonly feeTypes = signal<TuitionFeeType[]>([]);
  protected readonly isLoadingFeeTypes = signal(true);
  protected readonly isSavingFeeType = signal(false);
  protected readonly feeTypesError = signal<string | null>(null);
  protected readonly editingFeeTypeId = signal<string | null>(null);
  protected readonly isRenamingFeeType = signal(false);
  protected readonly deactivatingFeeTypeId = signal<string | null>(null);

  protected readonly fees = signal<TuitionFee[]>([]);
  protected readonly isLoadingFees = signal(true);
  protected readonly isCreatingFee = signal(false);
  protected readonly applyingFeeId = signal<string | null>(null);
  protected readonly feesError = signal<string | null>(null);

  protected readonly outstandingCharges = signal<StudentFeeCharge[]>([]);
  protected readonly isLoadingCharges = signal(true);
  protected readonly chargesError = signal<string | null>(null);
  protected readonly paymentChargeId = signal<string | null>(null);
  protected readonly isSavingPaymentFor = signal<string | null>(null);
  protected readonly paymentError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly historyStudentId = signal('');
  protected readonly studentCharges = signal<StudentFeeCharge[]>([]);
  protected readonly isLoadingStudentCharges = signal(false);
  protected readonly studentChargesError = signal<string | null>(null);
  protected readonly receipt = signal<PaymentReceipt | null>(null);
  protected readonly loadingReceiptId = signal<string | null>(null);
  protected readonly receiptError = signal<string | null>(null);

  protected feeName = '';
  protected readonly feeTypeId = signal('');
  protected feeTypeCode = '';
  protected feeTypeName = '';
  protected feeTypeEditName = '';
  protected newPaymentMethodCode = '';
  protected newPaymentMethodName = '';
  protected paymentMethodEditName = '';
  protected feeAmount: number | null = null;
  protected feeCurrency = 'XOF';
  protected feeDueDate = '';
  protected feeScope: FeeScope = 'ACADEMIC_YEAR';
  protected feeSchoolClassId = '';
  protected feeStudentId = '';
  protected paymentAmount: number | null = null;
  protected paymentMethodCode = '';
  protected paymentReference = '';

  ngOnInit(): void {
    this.loadPaymentMethods();
    this.loadFeeTypes();
    this.loadFees();
    this.loadOutstandingCharges();
  }

  protected selectView(view: FinanceView): void {
    this.activeView.set(view);
  }

  protected loadPaymentMethods(): void {
    this.isLoadingMethods.set(true);
    this.methodsError.set(null);
    this.tuitionService.getPaymentMethods(this.establishmentId()).subscribe({
      next: (methods) => {
        this.paymentMethods.set(methods);
        this.isLoadingMethods.set(false);
      },
      error: (error: unknown) => {
        this.methodsError.set(this.errorFor(error, 'Impossible de charger les moyens de paiement.'));
        this.isLoadingMethods.set(false);
      }
    });
  }

  protected beginAddingPaymentMethod(): void {
    this.isAddingPaymentMethod.set(true);
    this.newPaymentMethodCode = '';
    this.newPaymentMethodName = '';
    this.methodsError.set(null);
  }

  protected cancelAddingPaymentMethod(): void {
    this.isAddingPaymentMethod.set(false);
    this.methodsError.set(null);
  }

  protected saveNewPaymentMethod(): void {
    const code = this.newPaymentMethodCode.trim().toUpperCase();
    const name = this.newPaymentMethodName.trim();
    if (!/^[A-Z][A-Z0-9_]{0,39}$/.test(code) || !name || name.length > 100 || this.isSavingPaymentMethod()) {
      this.methodsError.set('Saisissez un code valide et un libellé de 100 caractères maximum.');
      return;
    }
    if (this.paymentMethods().some((method) => method.code === code)) {
      this.methodsError.set('Ce code de moyen de paiement existe déjà.');
      return;
    }

    const methods = [...this.paymentMethods().map(({ code: methodCode, name: methodName }) => ({ code: methodCode, name: methodName })), { code, name }];
    this.methodsError.set(null);
    this.isSavingPaymentMethod.set(true);
    this.tuitionService.replacePaymentMethods(this.establishmentId(), methods).subscribe({
      next: (savedMethods) => {
        this.paymentMethods.set(savedMethods);
        this.isAddingPaymentMethod.set(false);
        this.isSavingPaymentMethod.set(false);
        this.successMessage.set(`Moyen de paiement « ${name} » ajouté.`);
      },
      error: (error: unknown) => {
        this.methodsError.set(this.errorFor(error, 'Impossible d’ajouter ce moyen de paiement.'));
        this.isSavingPaymentMethod.set(false);
      }
    });
  }

  protected startRenamingPaymentMethod(method: TuitionPaymentMethod): void {
    this.editingPaymentMethodCode.set(method.code);
    this.paymentMethodEditName = method.name;
    this.methodsError.set(null);
  }

  protected cancelRenamingPaymentMethod(): void {
    this.editingPaymentMethodCode.set(null);
    this.methodsError.set(null);
  }

  protected renamePaymentMethod(method: TuitionPaymentMethod): void {
    const name = this.paymentMethodEditName.trim();
    if (!name || name.length > 100 || this.isRenamingPaymentMethod()) {
      this.methodsError.set('Le libellé doit contenir de 1 à 100 caractères.');
      return;
    }
    if (name === method.name) {
      this.cancelRenamingPaymentMethod();
      return;
    }

    this.methodsError.set(null);
    this.isRenamingPaymentMethod.set(true);
    const request: RenamePaymentMethodRequest = { name };
    this.tuitionService.renamePaymentMethod(this.establishmentId(), method.code, request).subscribe({
      next: (renamed) => {
        this.paymentMethods.update((methods) => methods.map((item) => item.code === renamed.code ? renamed : item));
        this.editingPaymentMethodCode.set(null);
        this.isRenamingPaymentMethod.set(false);
        this.successMessage.set(`Moyen de paiement renommé en « ${renamed.name} ».`);
      },
      error: (error: unknown) => {
        this.methodsError.set(this.errorFor(error, 'Impossible de renommer ce moyen de paiement.'));
        this.isRenamingPaymentMethod.set(false);
      }
    });
  }

  protected deactivatePaymentMethod(method: TuitionPaymentMethod): void {
    if (this.deactivatingPaymentMethodCode() || !window.confirm(`Désactiver « ${method.name} » ? Les reçus existants seront conservés.`)) return;

    this.methodsError.set(null);
    this.deactivatingPaymentMethodCode.set(method.code);
    this.tuitionService.deactivatePaymentMethod(this.establishmentId(), method.code).subscribe({
      next: () => {
        const remainingMethods = this.paymentMethods().filter((item) => item.code !== method.code);
        this.paymentMethods.set(remainingMethods);
        this.deactivatingPaymentMethodCode.set(null);
        this.successMessage.set(`Moyen de paiement « ${method.name} » désactivé.`);
        if (this.paymentMethodCode === method.code) this.paymentMethodCode = remainingMethods[0]?.code ?? '';
      },
      error: (error: unknown) => {
        this.methodsError.set(this.errorFor(error, 'Impossible de désactiver ce moyen de paiement.'));
        this.deactivatingPaymentMethodCode.set(null);
      }
    });
  }

  protected loadFees(): void {
    this.isLoadingFees.set(true);
    this.feesError.set(null);
    this.tuitionService.getTuitionFees(this.establishmentId(), this.academicYearId()).subscribe({
      next: (fees) => {
        this.fees.set(fees);
        this.isLoadingFees.set(false);
      },
      error: (error: unknown) => {
        this.feesError.set(this.errorFor(error, 'Impossible de charger les frais de cette année.'));
        this.isLoadingFees.set(false);
      }
    });
  }

  protected loadFeeTypes(): void {
    this.isLoadingFeeTypes.set(true);
    this.feeTypesError.set(null);
    this.tuitionService.getTuitionFeeTypes(this.establishmentId()).subscribe({
      next: (feeTypes) => {
        this.feeTypes.set(feeTypes);
        if (!feeTypes.some((feeType) => feeType.id === this.feeTypeId())) {
          this.feeTypeId.set(feeTypes[0]?.id ?? '');
        }
        this.isLoadingFeeTypes.set(false);
      },
      error: (error: unknown) => {
        this.feeTypesError.set(this.errorFor(error, 'Impossible de charger les types de frais.'));
        this.isLoadingFeeTypes.set(false);
      }
    });
  }

  protected createFeeType(): void {
    const code = this.feeTypeCode.trim().toUpperCase();
    const name = this.feeTypeName.trim();
    if (!/^[A-Z][A-Z0-9_]{0,39}$/.test(code) || !name || name.length > 100 || this.isSavingFeeType()) {
      this.feeTypesError.set('Saisissez un code valide et un libellé de 100 caractères maximum.');
      return;
    }
    if (this.feeTypes().some((feeType) => feeType.code === code)) {
      this.feeTypesError.set('Ce code de type de frais existe déjà.');
      return;
    }

    const request: CreateTuitionFeeTypeRequest = { code, name };
    this.feeTypesError.set(null);
    this.isSavingFeeType.set(true);
    this.tuitionService.createTuitionFeeType(this.establishmentId(), request).subscribe({
      next: (feeType) => {
        this.feeTypeCode = '';
        this.feeTypeName = '';
        this.feeTypeId.set(feeType.id);
        this.isSavingFeeType.set(false);
        this.successMessage.set(`Type de frais « ${feeType.name} » créé.`);
        this.loadFeeTypes();
      },
      error: (error: unknown) => {
        this.feeTypesError.set(this.feeTypeErrorFor(error, 'Impossible de créer ce type de frais.'));
        this.isSavingFeeType.set(false);
      }
    });
  }

  protected startRenamingFeeType(feeType: TuitionFeeType): void {
    this.editingFeeTypeId.set(feeType.id);
    this.feeTypeEditName = feeType.name;
    this.feeTypesError.set(null);
  }

  protected renameFeeType(feeType: TuitionFeeType): void {
    const name = this.feeTypeEditName.trim();
    if (!name || name.length > 100 || this.isRenamingFeeType()) {
      this.feeTypesError.set('Le libellé doit contenir de 1 à 100 caractères.');
      return;
    }
    if (name === feeType.name) {
      this.editingFeeTypeId.set(null);
      return;
    }

    const request: RenameTuitionFeeTypeRequest = { name };
    this.feeTypesError.set(null);
    this.isRenamingFeeType.set(true);
    this.tuitionService.renameTuitionFeeType(this.establishmentId(), feeType.id, request).subscribe({
      next: (renamed) => {
        this.feeTypes.update((feeTypes) => feeTypes.map((item) => item.id === renamed.id ? renamed : item));
        this.editingFeeTypeId.set(null);
        this.isRenamingFeeType.set(false);
        this.successMessage.set(`Type de frais renommé en « ${renamed.name} ».`);
      },
      error: (error: unknown) => {
        this.feeTypesError.set(this.feeTypeErrorFor(error, 'Impossible de renommer ce type de frais.'));
        this.isRenamingFeeType.set(false);
      }
    });
  }

  protected deactivateFeeType(feeType: TuitionFeeType): void {
    if (this.deactivatingFeeTypeId() || !window.confirm(`Désactiver le type « ${feeType.name} » ? Les frais et créances historiques seront conservés.`)) return;

    this.feeTypesError.set(null);
    this.deactivatingFeeTypeId.set(feeType.id);
    this.tuitionService.deactivateTuitionFeeType(this.establishmentId(), feeType.id).subscribe({
      next: () => {
        this.feeTypes.update((feeTypes) => feeTypes.filter((item) => item.id !== feeType.id));
        if (this.feeTypeId() === feeType.id) this.feeTypeId.set(this.feeTypes()[0]?.id ?? '');
        this.deactivatingFeeTypeId.set(null);
        this.successMessage.set(`Type de frais « ${feeType.name} » désactivé.`);
      },
      error: (error: unknown) => {
        this.feeTypesError.set(this.feeTypeErrorFor(error, 'Impossible de désactiver ce type de frais.'));
        this.deactivatingFeeTypeId.set(null);
      }
    });
  }

  protected createFee(): void {
    const name = this.feeName.trim();
    const currency = this.feeCurrency.trim().toUpperCase();
    const amount = Number(this.feeAmount);
    if (!name || name.length > 120 || !this.feeTypeId() || !Number.isFinite(amount) || amount <= 0 ||
        !/^[A-Z]{3}$/.test(currency) || !this.feeDueDate || this.isCreatingFee()) {
      this.feesError.set('Vérifiez le nom, le type, le montant positif, la devise et la date d’échéance.');
      return;
    }
    if (this.feeScope === 'SCHOOL_CLASS' && !this.feeSchoolClassId) {
      this.feesError.set('Choisissez une classe pour ce frais.');
      return;
    }
    if (this.feeScope === 'STUDENT' && !this.feeStudentId) {
      this.feesError.set('Choisissez un élève pour ce frais.');
      return;
    }

    const request: CreateTuitionFeeRequest = {
      name,
      feeTypeId: this.feeTypeId(),
      amount,
      currency,
      dueDate: this.feeDueDate,
      schoolClassId: this.feeScope === 'SCHOOL_CLASS' ? this.feeSchoolClassId : null,
      studentId: this.feeScope === 'STUDENT' ? this.feeStudentId : null
    };
    this.isCreatingFee.set(true);
    this.feesError.set(null);
    this.successMessage.set(null);
    this.tuitionService.createTuitionFee(this.establishmentId(), this.academicYearId(), request).subscribe({
      next: ({ fee, chargesCreated }) => {
        this.feeName = '';
        this.feeAmount = null;
        this.feeDueDate = '';
        this.feeScope = 'ACADEMIC_YEAR';
        this.feeSchoolClassId = '';
        this.feeStudentId = '';
        this.isCreatingFee.set(false);
        this.successMessage.set(`Frais « ${fee.name} » créé ; ${chargesCreated} créance(s) générée(s).`);
        this.loadFees();
        this.loadOutstandingCharges();
      },
      error: (error: unknown) => {
        this.feesError.set(this.errorFor(error, 'Impossible de créer ce frais.'));
        this.isCreatingFee.set(false);
      }
    });
  }

  protected applyFee(fee: TuitionFee): void {
    if (this.applyingFeeId()) return;
    this.applyingFeeId.set(fee.id);
    this.feesError.set(null);
    this.successMessage.set(null);
    this.tuitionService.applyTuitionFee(this.establishmentId(), this.academicYearId(), fee.id).subscribe({
      next: ({ chargesCreated }) => {
        this.applyingFeeId.set(null);
        this.successMessage.set(`${chargesCreated} nouvelle(s) créance(s) créée(s) pour « ${fee.name} ».`);
        this.loadOutstandingCharges();
      },
      error: (error: unknown) => {
        this.feesError.set(this.errorFor(error, 'Impossible d’appliquer ce frais.'));
        this.applyingFeeId.set(null);
      }
    });
  }

  protected loadOutstandingCharges(): void {
    this.isLoadingCharges.set(true);
    this.chargesError.set(null);
    this.tuitionService.getOutstandingCharges(this.establishmentId(), this.academicYearId()).subscribe({
      next: (charges) => {
        this.outstandingCharges.set(charges);
        this.isLoadingCharges.set(false);
      },
      error: (error: unknown) => {
        this.chargesError.set(this.errorFor(error, 'Impossible de charger les soldes impayés.'));
        this.isLoadingCharges.set(false);
      }
    });
  }

  protected startPayment(charge: StudentFeeCharge): void {
    this.paymentChargeId.set(charge.id);
    this.paymentAmount = charge.balance;
    this.paymentMethodCode = this.paymentMethods()[0]?.code ?? '';
    this.paymentReference = '';
    this.paymentError.set(null);
  }

  protected cancelPayment(): void {
    this.paymentChargeId.set(null);
    this.paymentError.set(null);
  }

  protected recordPayment(charge: StudentFeeCharge): void {
    const amount = Number(this.paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > charge.balance || !this.paymentMethodCode) {
      this.paymentError.set('Le montant doit être positif, ne pas dépasser le solde et utiliser un moyen configuré.');
      return;
    }
    const reference = this.paymentReference.trim();
    if (reference.length > 120) {
      this.paymentError.set('La référence ne peut pas dépasser 120 caractères.');
      return;
    }

    this.paymentError.set(null);
    this.isSavingPaymentFor.set(charge.id);
    this.successMessage.set(null);
    this.tuitionService.recordPayment(this.establishmentId(), charge.studentId, charge.id, {
      amount,
      paymentMethodCode: this.paymentMethodCode,
      ...(reference ? { reference } : {})
    }).subscribe({
      next: (payment) => {
        this.paymentChargeId.set(null);
        this.isSavingPaymentFor.set(null);
        this.successMessage.set(`Paiement enregistré. Reçu ${payment.receiptNumber}.`);
        this.loadOutstandingCharges();
        this.loadStudentCharges(this.historyStudentId() || charge.studentId);
        this.loadReceipt(payment.id);
      },
      error: (error: unknown) => {
        this.paymentError.set(this.errorFor(error, 'Impossible d’enregistrer le paiement.', true));
        this.isSavingPaymentFor.set(null);
      }
    });
  }

  protected loadStudentCharges(studentId: string): void {
    this.historyStudentId.set(studentId);
    this.isLoadingStudentCharges.set(true);
    this.studentChargesError.set(null);
    this.tuitionService.getStudentCharges(this.establishmentId(), studentId).subscribe({
      next: (charges) => {
        this.studentCharges.set(charges);
        this.isLoadingStudentCharges.set(false);
      },
      error: (error: unknown) => {
        this.studentChargesError.set(this.errorFor(error, 'Impossible de charger l’historique de cet élève.'));
        this.isLoadingStudentCharges.set(false);
      }
    });
  }

  protected onHistoryStudentChanged(event: Event): void {
    const studentId = (event.target as HTMLSelectElement).value;
    this.historyStudentId.set(studentId);
    this.studentCharges.set([]);
    this.receipt.set(null);
    if (studentId) this.loadStudentCharges(studentId);
  }

  protected loadReceipt(payment: TuitionPayment | string): void {
    const paymentId = typeof payment === 'string' ? payment : payment.id;
    this.loadingReceiptId.set(paymentId);
    this.receiptError.set(null);
    this.tuitionService.getReceipt(this.establishmentId(), paymentId).subscribe({
      next: (receipt) => {
        this.receipt.set(receipt);
        this.loadingReceiptId.set(null);
      },
      error: (error: unknown) => {
        this.receiptError.set(this.errorFor(error, 'Impossible de consulter ce reçu.'));
        this.loadingReceiptId.set(null);
      }
    });
  }

  protected scopeLabel(fee: TuitionFee): string {
    if (fee.scope === 'SCHOOL_CLASS') {
      return `Classe : ${this.classes().find((item) => item.id === fee.schoolClassId)?.name ?? 'inconnue'}`;
    }
    if (fee.scope === 'STUDENT') {
      const student = this.students().find((item) => item.id === fee.studentId);
      return student ? `Élève : ${student.firstName} ${student.lastName}` : 'Élève spécifique';
    }
    return 'Toute l’année';
  }

  protected studentName(charge: StudentFeeCharge): string {
    return `${charge.studentFirstName} ${charge.studentLastName}`;
  }

  protected paymentMethodName(code: string): string {
    return this.paymentMethods().find((method) => method.code === code)?.name ?? code;
  }

  protected formatAmount(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
    } catch {
      return `${amount} ${currency}`;
    }
  }

  private feeTypeErrorFor(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return 'Le code ou le libellé du type de frais est invalide.';
      if (error.status === 403) return 'Votre compte ne dispose pas de la permission nécessaire pour gérer les types de frais.';
      if (error.status === 404) return 'Ce type de frais est introuvable ou déjà désactivé.';
      if (error.status === 409) return 'Ce code de type de frais est déjà utilisé.';
      if (error.status === 0) return 'Le serveur est inaccessible. Vérifiez la connexion puis réessayez.';
    }
    return fallback;
  }

  private errorFor(error: unknown, fallback: string, payment = false): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 400) return payment
        ? 'Montant ou moyen de paiement invalide. Vérifiez le solde et le mode choisi.'
        : 'Certaines données sont invalides. Vérifiez les champs puis réessayez.';
      if (error.status === 403) return 'Votre compte ne dispose pas de la permission nécessaire.';
      if (error.status === 404) return 'L’établissement, l’année ou l’élément demandé est introuvable.';
      if (error.status === 409) return payment
        ? 'Le paiement dépasse le solde restant. Actualisez les créances.'
        : 'Un frais de même nom existe déjà pour cette année.';
      if (error.status === 0) return 'Le serveur est inaccessible. Vérifiez la connexion puis réessayez.';
    }
    return fallback;
  }
}