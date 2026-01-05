
import React, { useState, useMemo } from 'react';
import { Teacher, Slot, Day, DAYS, PERIODS, GRADES } from './types';
import { autoGenerateSchedule } from './services/geminiService';

const App: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [slots, setSlots] = useState<Slot[]>(() => {
    const initialSlots: Slot[] = [];
    GRADES.forEach(grade => {
      DAYS.forEach(day => {
        PERIODS.forEach(period => {
          initialSlots.push({ grade, day, period, isAvailable: false, assignedTeacherId: null });
        });
      });
    });
    return initialSlots;
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState('');
  const [newTeacherHours, setNewTeacherHours] = useState<number>(1);
  const [newTeacherGrades, setNewTeacherGrades] = useState<number[]>([]);

  const getTeacher = (id: string | null) => teachers.find(t => t.id === id);
  
  const stats = useMemo(() => {
    const required = teachers.reduce((sum, t) => sum + t.totalWeeklyHours, 0);
    const available = slots.filter(s => s.isAvailable).length;
    const assigned = slots.filter(s => s.assignedTeacherId !== null).length;
    return { required, available, assigned };
  }, [teachers, slots]);

  // 중복 배정 체크 (동일 시간대에 교사가 다른 학년 수업 중인지)
  const isTeacherConflicting = (teacherId: string, day: Day, period: number, currentGrade: number) => {
    return slots.some(s => 
      s.assignedTeacherId === teacherId && 
      s.day === day && 
      s.period === period && 
      s.grade !== currentGrade
    );
  };

  const toggleSlotAvailability = (grade: number, day: Day, period: number) => {
    setSlots(prev => prev.map(s => 
      (s.grade === grade && s.day === day && s.period === period) 
        ? { ...s, isAvailable: !s.isAvailable, assignedTeacherId: null } 
        : s
    ));
  };

  const assignTeacherToSlot = (grade: number, day: Day, period: number, teacherId: string | null) => {
    setSlots(prev => prev.map(s => 
      (s.grade === grade && s.day === day && s.period === period) 
        ? { ...s, assignedTeacherId: teacherId } 
        : s
    ));
  };

  const toggleGradeSelection = (grade: number) => {
    setNewTeacherGrades(prev => 
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    );
  };

  const addTeacher = () => {
    if (!newTeacherName || !newTeacherSubject || newTeacherGrades.length === 0) {
      alert("이름, 과목, 그리고 담당할 학년을 최소 하나 선택해주세요.");
      return;
    }
    setTeachers([...teachers, {
      id: crypto.randomUUID(),
      name: newTeacherName,
      subject: newTeacherSubject,
      totalWeeklyHours: newTeacherHours,
      targetGrades: newTeacherGrades
    }]);
    setNewTeacherName(''); setNewTeacherSubject(''); setNewTeacherHours(1); setNewTeacherGrades([]);
  };

  const removeTeacher = (id: string) => {
    setTeachers(teachers.filter(t => t.id !== id));
    setSlots(slots.map(s => s.assignedTeacherId === id ? { ...s, assignedTeacherId: null } : s));
  };

  const handleAutoAssign = async () => {
    if (stats.required > stats.available) {
      alert(`확보된 시간(${stats.available})보다 배분할 총 시수(${stats.required})가 더 많습니다.`);
      return;
    }
    setIsGenerating(true);
    try {
      const assignment = await autoGenerateSchedule(teachers, slots);
      setSlots(prev => prev.map(s => {
        const key = `${s.grade}-${s.day}-${s.period}`;
        return { ...s, assignedTeacherId: assignment[key] || s.assignedTeacherId };
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <header className="max-w-[1600px] mx-auto mb-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between items-center gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white">
            <i className="fas fa-calendar-check text-2xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">지능형 교담 시간표 관리자</h1>
            <p className="text-slate-500 text-sm">학년별 담당 교사 지정 및 수동 보정 기능 포함</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex gap-4 border-r border-slate-200 pr-6">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">목표 시수</p>
              <p className="text-lg font-black text-indigo-600">{stats.required}h</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">배정 현황</p>
              <p className="text-lg font-black text-emerald-600">{stats.assigned} / {stats.available}</p>
            </div>
          </div>
          <button 
            onClick={handleAutoAssign}
            disabled={isGenerating || teachers.length === 0}
            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            {isGenerating ? <i className="fas fa-sync fa-spin"></i> : <i className="fas fa-magic"></i>}
            AI 자동 배분
          </button>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-4 gap-8">
        <aside className="xl:col-span-1 space-y-6 no-print">
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
              <i className="fas fa-user-plus text-indigo-500"></i>
              교사 및 담당 학년 등록
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text" placeholder="교사명" value={newTeacherName}
                  onChange={e => setNewTeacherName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none text-sm"
                />
                <input 
                  type="text" placeholder="과목" value={newTeacherSubject}
                  onChange={e => setNewTeacherSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none text-sm"
                />
              </div>
              
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">담당 학년 선택</p>
                <div className="flex flex-wrap gap-2">
                  {GRADES.map(g => (
                    <button
                      key={g}
                      onClick={() => toggleGradeSelection(g)}
                      className={`w-9 h-9 rounded-lg text-xs font-bold transition-all border ${
                        newTeacherGrades.includes(g) 
                        ? 'bg-indigo-600 text-white border-indigo-600' 
                        : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl">
                <span className="text-sm font-bold text-slate-500 shrink-0">총 시수:</span>
                <input 
                  type="number" min="1" value={newTeacherHours}
                  onChange={e => setNewTeacherHours(Number(e.target.value))}
                  className="w-full bg-transparent border-none focus:ring-0 font-bold text-indigo-600"
                />
              </div>
              
              <button 
                onClick={addTeacher}
                className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all shadow-md"
              >
                교사 추가
              </button>
            </div>

            <div className="mt-8 space-y-3">
              {teachers.map(t => (
                <div key={t.id} className="group p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-100 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-800">{t.name} <span className="text-xs font-normal text-slate-400">| {t.subject}</span></h4>
                      <p className="text-[10px] font-bold text-indigo-500 mt-1">담당: {t.targetGrades.join(', ')}학년 ({t.totalWeeklyHours}h)</p>
                    </div>
                    <button onClick={() => removeTeacher(t.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <main className="xl:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {GRADES.map(grade => (
              <div key={grade} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col print:break-inside-avoid">
                <div className="flex justify-between items-center mb-4 px-2">
                  <h3 className="text-lg font-black text-slate-800">{grade}학년</h3>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="w-2 h-2 rounded-full bg-slate-200"></span>
                  </div>
                </div>
                
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="p-2 border-r border-slate-100 text-slate-400"></th>
                        {DAYS.map(d => <th key={d} className="p-2 font-bold text-slate-600">{d}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {PERIODS.map(p => (
                        <tr key={p} className="border-t border-slate-100">
                          <td className="p-2 text-center border-r border-slate-100 text-slate-400 font-bold">{p}</td>
                          {DAYS.map(day => {
                            const slot = slots.find(s => s.grade === grade && s.day === day && s.period === p)!;
                            const teacher = getTeacher(slot.assignedTeacherId);
                            const hasConflict = slot.assignedTeacherId && isTeacherConflicting(slot.assignedTeacherId, day, p, grade);
                            
                            // 해당 학년을 담당하는 교사들만 필터링
                            const eligibleTeachers = teachers.filter(t => t.targetGrades.includes(grade));

                            return (
                              <td 
                                key={day}
                                className={`
                                  group relative h-16 p-0 text-center transition-all border-r last:border-r-0 border-slate-50
                                  ${slot.isAvailable ? 'bg-indigo-50/50' : 'bg-white'}
                                  ${hasConflict ? 'bg-red-50' : ''}
                                `}
                              >
                                {/* 클릭 영역: 비어있으면 교담 가능 시간 토글 / 설정되어 있으면 교사 선택 */}
                                {!slot.isAvailable ? (
                                  <div 
                                    className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
                                    onClick={() => toggleSlotAvailability(grade, day, p)}
                                  >
                                    <i className="fas fa-plus text-slate-300"></i>
                                  </div>
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center p-1">
                                    <select
                                      value={slot.assignedTeacherId || ""}
                                      onChange={(e) => assignTeacherToSlot(grade, day, p, e.target.value || null)}
                                      className={`w-full bg-transparent border-none text-center font-bold text-indigo-700 focus:ring-0 cursor-pointer appearance-none text-[10px] ${hasConflict ? 'text-red-600' : ''}`}
                                    >
                                      <option value="">(없음)</option>
                                      {eligibleTeachers.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}({t.subject})</option>
                                      ))}
                                    </select>
                                    
                                    {/* 교담 가능 시간 해제 버튼 */}
                                    <button 
                                      onClick={() => toggleSlotAvailability(grade, day, p)}
                                      className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 text-[8px] text-slate-300 hover:text-red-400 no-print"
                                    >
                                      <i className="fas fa-times"></i>
                                    </button>

                                    {hasConflict && (
                                      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-1 no-print">
                                        <i className="fas fa-exclamation-triangle text-red-500 text-[8px]" title="중복 배정됨"></i>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <footer className="mt-12 max-w-[1600px] mx-auto bg-slate-800 text-slate-400 p-6 rounded-3xl flex justify-between items-center no-print">
        <div className="text-xs space-y-1">
          <p><span className="text-white font-bold">도움말:</span> 하늘색 칸의 이름을 클릭하여 수동으로 교사를 변경하거나 배정할 수 있습니다.</p>
          <p><span className="text-red-400 font-bold">중복 경고:</span> 동일 교시에 한 교사가 여러 학년에 배정되면 삼각형 아이콘이 표시됩니다.</p>
        </div>
        <div className="text-[10px] uppercase tracking-tighter">
          Powered by Gemini AI Engine
        </div>
      </footer>
    </div>
  );
};

export default App;
