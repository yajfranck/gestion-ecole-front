import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SubjectListComponent } from '../../subject/subject-list/subject-list.component';

@Component({
  selector: 'app-establishment-referentials',
  imports: [SubjectListComponent],
  templateUrl: './establishment-referentials.component.html',
  styleUrl: './establishment-referentials.component.css'
})
export class EstablishmentReferentialsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  protected readonly establishmentId = signal('');

  ngOnInit(): void {
    this.establishmentId.set(this.route.snapshot.paramMap.get('establishmentId') ?? '');
  }
}
