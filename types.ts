
export type Day = '월' | '화' | '수' | '목' | '금';
export const DAYS: Day[] = ['월', '화', '수', '목', '금'];
export const PERIODS = [1, 2, 3, 4, 5, 6]; 
export const GRADES = [1, 2, 3, 4, 5, 6];

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  totalWeeklyHours: number;
  targetGrades: number[]; // 담당할 학년 목록 (예: [3, 4])
}

export interface Slot {
  grade: number;
  day: Day;
  period: number;
  isAvailable: boolean;
  assignedTeacherId: string | null;
}
