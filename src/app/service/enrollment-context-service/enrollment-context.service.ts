import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, defer, Observable, of, shareReplay, throwError } from 'rxjs';
import { Guardian } from '../../models/guardian/guardian.model';
import { Student } from '../../models/student/student.model';
import { ClassroomService } from '../classroom-service/classroom.service';
import { GuardianService } from '../guardian-service/guardian.service';
import { StudentService } from '../student-service/student.service';
import { TuitionService } from '../tuition-service/tuition.service';

/** Données en mémoire d’un seul parcours, détruites à la fermeture de sa modale. */
@Injectable()
export class EnrollmentContextService {
  private readonly students = inject(StudentService);
  private readonly guardians = inject(GuardianService);
  private readonly classrooms = inject(ClassroomService);
  private readonly tuition = inject(TuitionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reads = new Map<string, Observable<unknown>>();

  setStudent(student: Student): void {
    this.reads.set(this.key('student', student.establishmentId, student.id), of(student));
  }

  getStudent(establishmentId: string, studentId: string) {
    return this.read(this.key('student', establishmentId, studentId), () => this.students.getStudent(establishmentId, studentId));
  }

  setGuardians(establishmentId: string, studentId: string, guardians: Guardian[]): void {
    this.reads.set(this.key('guardians', establishmentId, studentId), of(guardians));
  }

  getGuardians(establishmentId: string, studentId: string) {
    return this.read(this.key('guardians', establishmentId, studentId), () => this.guardians.getGuardians(establishmentId, studentId));
  }

  getClassrooms(establishmentId: string, academicYearId: string, schoolClassId: string) {
    return this.read(this.key('classrooms', establishmentId, academicYearId, schoolClassId), () => this.classrooms.list(establishmentId, academicYearId, schoolClassId));
  }

  getTuitionFees(establishmentId: string, academicYearId: string, refresh = false) {
    return this.read(this.key('fees', establishmentId, academicYearId), () => this.tuition.getTuitionFees(establishmentId, academicYearId), refresh);
  }

  getStudentCharges(establishmentId: string, academicYearId: string, studentId: string, refresh = false) {
    return this.read(this.key('charges', establishmentId, academicYearId, studentId), () => this.tuition.getStudentCharges(establishmentId, academicYearId, studentId), refresh);
  }

  getPaymentMethods(establishmentId: string, refresh = false) {
    return this.read(this.key('methods', establishmentId), () => this.tuition.getPaymentMethods(establishmentId), refresh);
  }

  invalidatePayments(establishmentId: string, academicYearId: string, studentId: string): void {
    this.reads.delete(this.key('fees', establishmentId, academicYearId));
    this.reads.delete(this.key('charges', establishmentId, academicYearId, studentId));
    this.reads.delete(this.key('methods', establishmentId));
  }

  clear(): void { this.reads.clear(); }

  private key(...parts: string[]): string { return JSON.stringify(parts); }

  private read<T>(key: string, load: () => Observable<T>, refresh = false): Observable<T> {
    const cached = this.reads.get(key);
    if (cached && !refresh) return cached as Observable<T>;
    const request: Observable<T> = defer(load).pipe(
      takeUntilDestroyed(this.destroyRef),
      catchError((error: unknown) => {
        if (this.reads.get(key) === request) this.reads.delete(key);
        return throwError(() => error);
      }),
      // Une requête démarrée reste partagée si son formulaire est démonté au retour.
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.reads.set(key, request);
    return request;
  }
}
