
export type Day = '월' | '화' | '수' | '목' | '금';
export const DAYS: Day[] = ['월', '화', '수', '목', '금'];
export const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  weeklyHours: number;
}

export interface Slot {
  day: Day;
  period: number;
  isAvailable: boolean; // Is this slot designated for subject teaching?
  assignedTeacherId: string | null;
}

export interface ScheduleState {
  teachers: Teacher[];
  slots: Slot[];
}
