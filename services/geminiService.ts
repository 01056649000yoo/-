
import { GoogleGenAI, Type } from "@google/genai";
import { Teacher, Slot, DAYS, PERIODS, GRADES } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const autoGenerateSchedule = async (
  teachers: Teacher[],
  allSlots: Slot[]
): Promise<Record<string, string>> => {
  const availableSlots = allSlots
    .filter(s => s.isAvailable)
    .map(s => `${s.grade}-${s.classNumber}-${s.day}-${s.period}`);

  const teachersInput = teachers.map(t => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    totalHours: t.totalWeeklyHours,
    targetGrades: t.targetGrades
  }));

  const prompt = `
    당신은 학교 시간표 최적화 전문가입니다.
    
    [입력 데이터]
    1. 배분 가능 슬롯 (학년-반-요일-교시): ${availableSlots.join(', ')}
    2. 교사 정보: ${JSON.stringify(teachersInput)}
    
    [배분 규칙]
    1. 각 교사는 'targetGrades'에 포함된 학년의 슬롯에만 배정될 수 있음.
    2. 각 교사는 'totalHours'만큼만 수업을 배정받아야 함.
    3. 절대 중복 방지: 동일한 (요일-교시)에 한 명의 교사가 어떤 학년의 어떤 반에도 중복 배정될 수 없음.
    4. 한 슬롯에는 한 명의 교사만 배정.
    
    응답 형식 JSON: { "학년-반-요일-교시": "교사ID" }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI 배분 실패, Fallback 실행");
    const distribution: Record<string, string> = {};
    const teacherWorkload: Record<string, number> = {};
    teachers.forEach(t => teacherWorkload[t.id] = 0);

    for (const day of DAYS) {
      for (const period of PERIODS) {
        const busyTeachersThisPeriod = new Set<string>();
        
        // 가용 슬롯들을 섞어서 배정의 다양성 확보
        const availableInThisTime = allSlots.filter(s => s.isAvailable && s.day === day && s.period === period);
        
        for (const slot of availableInThisTime) {
          const slotKey = `${slot.grade}-${slot.classNumber}-${slot.day}-${slot.period}`;
          const possibleTeacher = teachers.find(t => 
            t.targetGrades.includes(slot.grade) &&
            teacherWorkload[t.id] < t.totalWeeklyHours && 
            !busyTeachersThisPeriod.has(t.id)
          );
          
          if (possibleTeacher) {
            distribution[slotKey] = possibleTeacher.id;
            teacherWorkload[possibleTeacher.id]++;
            busyTeachersThisPeriod.add(possibleTeacher.id);
          }
        }
      }
    }
    return distribution;
  }
};
