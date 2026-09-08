import { Pipe, PipeTransform } from '@angular/core';

const PLAYOFF_WEEK_LABELS: { [week: number]: string } = {
  19: 'Wild Card',
  20: 'Divisional',
  21: 'Conference Championship',
  22: 'Super Bowl'
};

export function getWeekLabel(week: number): string {
  return PLAYOFF_WEEK_LABELS[week] || `Week ${week}`;
}

@Pipe({
  name: 'weekLabel',
  standalone: true
})
export class WeekLabelPipe implements PipeTransform {
  transform(week: number): string {
    return getWeekLabel(week);
  }
}
