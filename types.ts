
export type Day = '월' | '화' | '수' | '목' | '금';
export const DAYS: Day[] = ['월', '화', '수', '목', '금'];
export const PERIODS = [1, 2, 3, 4, 5, 6]; 
export const GRADES = [1, 2, 3, 4, 5, 6];

export const SUBJECTS = [
  '과학',
  '영어',
  '체육',
  '음악',
  '미술',
  '실과',
  '도덕',
  '사회',
  '수학',
  '국어'
];

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  totalWeeklyHours: number;
  targetGrades: number[];
}

export interface Slot {
  grade: number;
  classNumber: number; // 반 번호 (1반, 2반...)
  day: Day;
  period: number;
  isAvailable: boolean;
  assignedTeacherId: string | null;
}
