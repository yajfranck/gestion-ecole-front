import { TableActionDirective } from '../../../shared/table-actions/table-action.directive';
import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { LucideClock3, LucideMapPin, LucideUserRound } from '@lucide/angular';
import { Employee } from '../../../models/employee/employee.model';
import { Subject } from '../../../models/subject/subject.model';
import { TimetableColumn, TimetableEntry } from '../../../models/timetable/timetable.model';
import { localDateKey } from '../../../shared/date-range';
import { TableActionsComponent } from '../../../shared/table-actions/table-actions.component';

const SUBJECT_COLORS = [
  { card: 'border-l-[#47745d] border-[#ccdfd1] bg-[#eff7f1]', dot: 'bg-[#47745d]' },
  { card: 'border-l-[#527fad] border-[#cddfee] bg-[#f0f6fc]', dot: 'bg-[#527fad]' },
  { card: 'border-l-[#9270b5] border-[#e0d4ee] bg-[#f7f2fc]', dot: 'bg-[#9270b5]' },
  { card: 'border-l-[#ac803e] border-[#e9dbc3] bg-[#fcf7ed]', dot: 'bg-[#ac803e]' },
  { card: 'border-l-[#b76e86] border-[#edd3dd] bg-[#fcf2f6]', dot: 'bg-[#b76e86]' },
  { card: 'border-l-[#448d91] border-[#cbe3e3] bg-[#eff8f8]', dot: 'bg-[#448d91]' },
] as const;

function minutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
function timeLabel(value: number): string {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}

@Component({
  selector: 'app-timetable-board',
  imports: [TableActionDirective, DatePipe, TableActionsComponent, LucideClock3, LucideMapPin, LucideUserRound],
  templateUrl: './timetable-board.component.html',
  styleUrl: './timetable-board.component.css',
})
export class TimetableBoardComponent {
  readonly columns = input<TimetableColumn[]>([]);
  readonly subjects = input<Subject[]>([]);
  readonly employees = input<Employee[]>([]);
  readonly showPeriod = input(false);
  readonly disabled = input(false);
  readonly canEdit = input(false);
  readonly canArchive = input(false);
  readonly edit = output<TimetableEntry>();
  readonly archive = output<TimetableEntry>();
  protected readonly today = localDateKey();
  // L'axe est dérivé des horaires reçus, sans définir d'horaires ou de pauses métier.
  protected readonly boundaries = computed(() => {
    const values = this.columns().flatMap((day) =>
      day.withinAcademicYear && !day.nonWorkingDay
        ? day.entries.flatMap((entry) => [minutes(entry.startTime), minutes(entry.endTime)])
        : [],
    );
    if (!values.length) return [];
    const start = Math.min(...values);
    const end = Math.max(...values);
    for (let time = Math.ceil(start / 60) * 60; time < end; time += 60) values.push(time);
    return [...new Set(values)].sort((a, b) => a - b);
  });
  protected readonly slots = computed(() =>
    this.boundaries()
      .slice(0, -1)
      .map((start, index) => ({
        start: timeLabel(start),
        end: timeLabel(this.boundaries()[index + 1]),
        row: index + 2,
      })),
  );
  protected readonly rowTemplate = computed(
    () => `auto repeat(${Math.max(1, this.slots().length)}, minmax(80px, auto))`,
  );
  protected readonly layout = computed(() => {
    const bounds = this.boundaries();
    return this.columns().map((day) => {
      const entries =
        day.withinAcademicYear && !day.nonWorkingDay
          ? [...day.entries].sort(
              (a, b) => minutes(a.startTime) - minutes(b.startTime) || a.id.localeCompare(b.id),
            )
          : [];
      // Le modèle peut contenir des créneaux de périodes différentes à la même heure.
      // Des sous-colonnes évitent de masquer l'un de ces créneaux.
      const laneEnds: number[] = [];
      const courses = entries.map((entry) => {
        const start = minutes(entry.startTime);
        const end = minutes(entry.endTime);
        let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = end;
        return {
          entry,
          start,
          lane: lane + 1,
          row: `${bounds.indexOf(start) + 2} / ${bounds.indexOf(end) + 2}`,
        };
      });
      const gaps: { start: string; end: string; row: string }[] = [];
      if (entries.length && bounds.length) {
        let cursor = bounds[0];
        for (const entry of entries) {
          const start = minutes(entry.startTime);
          if (start > cursor)
            gaps.push({
              start: timeLabel(cursor),
              end: timeLabel(start),
              row: `${bounds.indexOf(cursor) + 2} / ${bounds.indexOf(start) + 2}`,
            });
          cursor = Math.max(cursor, minutes(entry.endTime));
        }
        const end = bounds[bounds.length - 1];
        if (cursor < end)
          gaps.push({
            start: timeLabel(cursor),
            end: timeLabel(end),
            row: `${bounds.indexOf(cursor) + 2} / ${bounds.length + 1}`,
          });
      }
      const blocks = [
        ...courses.map((course) => ({ kind: 'course' as const, start: course.start, course })),
        ...gaps.map((gap) => ({ kind: 'gap' as const, start: minutes(gap.start), gap })),
      ].sort((a, b) => a.start - b.start);
      return { ...day, courses, gaps, blocks, lanes: Math.max(1, laneEnds.length) };
    });
  });
  protected readonly columnTemplate = computed(
    () =>
      `4.5rem ${this.layout()
        .map((day) => `minmax(${day.lanes * 200}px, ${day.lanes}fr)`)
        .join(' ')}`,
  );
  protected readonly legend = computed(() => [
    ...new Set(this.layout().flatMap((day) => day.courses.map((course) => course.entry.subjectId))),
  ]);
  protected palette(id: string) {
    let hash = 0;
    for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
  }
  protected dayDate(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
  }
  protected subjectName(id: string): string {
    return this.subjects().find((subject) => subject.id === id)?.name ?? 'Matière affectée';
  }
  protected teacherName(id: string | null): string {
    if (!id) return 'Enseignant non affecté';
    const employee = this.employees().find((item) => item.id === id);
    return employee ? `${employee.firstName} ${employee.lastName}` : 'Enseignant affecté';
  }
}
