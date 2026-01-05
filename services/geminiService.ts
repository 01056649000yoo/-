
import { GoogleGenAI, Type } from "@google/genai";
import { Teacher, Slot, Day } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const autoGenerateSchedule = async (
  teachers: Teacher[],
  availableSlots: Slot[]
): Promise<Record<string, string>> => {
  // Convert slots to a simpler representation for the prompt
  const slotsInput = availableSlots
    .filter(s => s.isAvailable)
    .map(s => `${s.day}-${s.period}`);

  const teachersInput = teachers.map(t => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    hours: t.weeklyHours
  }));

  const prompt = `
    학교 시간표 배분 전문가로서 다음 조건에 따라 교담(전담) 교사의 시수를 배분해줘.
    
    1. 배분 가능한 교담 시간(요일-교시): ${slotsInput.join(', ')}
    2. 교담 교사 정보: ${JSON.stringify(teachersInput)}
    
    배분 규칙:
    - 각 교사의 주당 시수(hours)를 정확히 채워야 함.
    - 한 교시에 한 명의 교사만 배분 가능.
    - 가능한 특정 요일에 시수가 너무 몰리지 않게 균형 있게 배분.
    
    반드시 JSON 형식으로 응답할 것.
    형식: { "요일-교시": "교사ID" }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          description: "Map of period identifier (Day-Period) to teacher ID",
          properties: {}, // Flexible key mapping
        }
      }
    });

    const result = JSON.parse(response.text);
    return result;
  } catch (error) {
    console.error("Gemini optimization failed", error);
    // Fallback: Simple greedy distribution logic
    const distribution: Record<string, string> = {};
    const sortedSlots = availableSlots.filter(s => s.isAvailable);
    let slotIndex = 0;

    for (const teacher of teachers) {
      for (let i = 0; i < teacher.weeklyHours; i++) {
        if (slotIndex < sortedSlots.length) {
          const slot = sortedSlots[slotIndex];
          distribution[`${slot.day}-${slot.period}`] = teacher.id;
          slotIndex++;
        }
      }
    }
    return distribution;
  }
};
