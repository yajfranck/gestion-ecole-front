import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SchoolClassManagerComponent } from '../school-class-manager/school-class-manager.component';

@Component({
  selector: 'app-academic-year-classes',
  imports: [SchoolClassManagerComponent],
  templateUrl: './academic-year-classes.component.html',
  styleUrl: './academic-year-classes.component.css'
})
export class AcademicYearClassesComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  protected readonly establishmentId = signal('');
  protected readonly academicYearId = signal('');
  protected readonly selectedClassId = signal<string | null>(null);

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.establishmentId.set(params.get('establishmentId') ?? '');
    this.academicYearId.set(params.get('academicYearId') ?? '');
    this.selectedClassId.set(this.route.snapshot.queryParamMap.get('classId'));
  }
}
