
import React, { useState, useEffect, useCallback } from 'react';
import { Teacher, Slot, Day, DAYS, PERIODS } from './types';
import { autoGenerateSchedule } from './services/geminiService';

const App: React.FC = () => {
  // --- State ---
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [slots, setSlots] = useState<Slot[]>(() => {
    const initialSlots: Slot[] = [];
    DAYS.forEach(day => {
      PERIODS.forEach(period => {
        initialSlots.push({ day, period, isAvailable: false, assignedTeacherId: null });
      });
    });
    return initialSlots;
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState('');
  const [newTeacherHours, setNewTeacherHours] = useState<number>(1);

  // --- Handlers ---
  const toggleSlotAvailability = (day: Day, period: number) => {
    setSlots(prev => prev.map(s => 
      (s.day === day && s.period === period) 
        ? { ...s, isAvailable: !s.isAvailable, assignedTeacherId: null } 
        : s
    ));
  };

  const addTeacher = () => {
    if (!newTeacherName || !newTeacherSubject) return;
    const teacher: Teacher = {
      id: crypto.randomUUID(),
      name: newTeacherName,
      subject: newTeacherSubject,
      weeklyHours: newTeacherHours
    };
    setTeachers(prev => [...prev, teacher]);
    setNewTeacherName('');
    setNewTeacherSubject('');
    setNewTeacherHours(1);
  };

  const removeTeacher = (id: string) => {
    setTeachers(prev => prev.filter(t => t.id !== id));
    setSlots(prev => prev.map(s => s.assignedTeacherId === id ? { ...s, assignedTeacherId: null } : s));
  };

  const handleAutoAssign = async () => {
    const totalRequiredHours = teachers.reduce((sum, t) => sum + t.weeklyHours, 0);
    const availableSlotCount = slots.filter(s => s.isAvailable).length;

    if (totalRequiredHours > availableSlotCount) {
      alert(`배분할 시수(${totalRequiredHours})가 확보된 교담 시간(${availableSlotCount})보다 많습니다.`);
      return;
    }

    setIsGenerating(true);
    try {
      const assignment = await autoGenerateSchedule(teachers, slots);
      setSlots(prev => prev.map(s => {
        const key = `${s.day}-${s.period}`;
        return { ...s, assignedTeacherId: assignment[key] || null };
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const resetAssignments = () => {
    setSlots(prev => prev.map(s => ({ ...s, assignedTeacherId: null })));
  };

  const getTeacher = (id: string | null) => teachers.find(t => t.id === id);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col gap-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 no-print">
        <div>
          <h1 className="text-2xl font-bold text-indigo-700 flex items-center gap-2">
            <i className="fas fa-calendar-alt"></i>
            교담 시수 자동 배분 시스템
          </h1>
          <p className="text-slate-500 mt-1">학급 시간표에 교담(전담) 교사의 수업을 스마트하게 배분하세요.</p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <button 
            onClick={handleAutoAssign}
            disabled={isGenerating || teachers.length === 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
            자동 배분 시작
          </button>
          <button 
            onClick={() => window.print()}
            className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition flex items-center gap-2"
          >
            <i className="fas fa-print"></i>
            인쇄하기
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Configuration */}
        <aside className="lg:col-span-4 space-y-8 no-print">
          {/* Section 1: Teacher Input */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <i className="fas fa-user-tie text-indigo-500"></i>
              교담 교사 설정
            </h2>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="교사 이름 (예: 김교사)" 
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
              />
              <input 
                type="text" 
                placeholder="과목 (예: 체육)" 
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newTeacherSubject}
                onChange={(e) => setNewTeacherSubject(e.target.value)}
              />
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 font-medium">주당 시수:</span>
                <input 
                  type="number" 
                  min="1" 
                  max="20"
                  className="w-20 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={newTeacherHours}
                  onChange={(e) => setNewTeacherHours(parseInt(e.target.value) || 1)}
                />
                <button 
                  onClick={addTeacher}
                  className="flex-1 bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-900 transition font-bold"
                >
                  추가
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-2 max-h-60 overflow-y-auto pr-2">
              {teachers.map(t => (
                <div key={t.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                  <div>
                    <p className="font-bold text-slate-800">{t.name} <span className="text-xs font-normal text-slate-500">({t.subject})</span></p>
                    <p className="text-xs text-indigo-600 font-semibold">{t.weeklyHours}시간/주</p>
                  </div>
                  <button 
                    onClick={() => removeTeacher(t.id)}
                    className="text-slate-400 hover:text-red-500 transition p-1"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
              {teachers.length === 0 && <p className="text-center text-slate-400 py-4 text-sm italic">교사를 추가해주세요.</p>}
            </div>
          </section>

          {/* Section 2: Summary Information */}
          <section className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
            <h3 className="font-bold text-indigo-900 mb-2">배분 현황</h3>
            <div className="space-y-1 text-sm text-indigo-800">
              <div className="flex justify-between">
                <span>필요 시수 총합:</span>
                <span className="font-bold">{teachers.reduce((s, t) => s + t.weeklyHours, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>확보된 교담 시간:</span>
                <span className="font-bold">{slots.filter(s => s.isAvailable).length}</span>
              </div>
            </div>
            <div className="mt-4 bg-white h-2 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-500 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, (teachers.reduce((s, t) => s + t.weeklyHours, 0) / (slots.filter(s => s.isAvailable).length || 1)) * 100)}%` }}
              ></div>
            </div>
          </section>
        </aside>

        {/* Right Column: Timetable Grid */}
        <main className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto print:p-0 print:shadow-none print:border-none">
            <div className="flex justify-between items-center mb-6 no-print">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <i className="fas fa-th-large text-indigo-500"></i>
                학급 시간표
              </h2>
              <div className="text-xs flex gap-4 text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-indigo-100 border border-indigo-200 rounded-sm"></span> 교담 가능 시간</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-white border border-slate-200 rounded-sm"></span> 담임 수업 시간</span>
              </div>
            </div>

            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr>
                  <th className="w-16 p-3 border-b-2 border-slate-100"></th>
                  {DAYS.map(day => (
                    <th key={day} className="p-3 border-b-2 border-slate-100 text-slate-600 font-bold">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(period => (
                  <tr key={period}>
                    <td className="p-3 text-center border-r-2 border-slate-100 text-slate-400 font-medium text-sm">{period}교시</td>
                    {DAYS.map(day => {
                      const slot = slots.find(s => s.day === day && s.period === period)!;
                      const teacher = getTeacher(slot.assignedTeacherId);
                      
                      return (
                        <td 
                          key={`${day}-${period}`} 
                          className={`p-1 border border-slate-100 relative h-24 transition-all
                            ${slot.isAvailable ? 'bg-indigo-50/50' : 'bg-white'}
                            ${slot.isAvailable ? 'hover:bg-indigo-100' : 'hover:bg-slate-50'}
                            cursor-pointer group no-print`}
                          onClick={() => toggleSlotAvailability(day, period)}
                        >
                          {!slot.isAvailable ? (
                            <div className="flex items-center justify-center h-full opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[10px] text-slate-400 uppercase tracking-tighter">교담지정</span>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center relative p-1">
                              {teacher ? (
                                <div className="animate-in fade-in zoom-in duration-300 w-full text-center">
                                  <p className="text-sm font-bold text-indigo-900 leading-tight">{teacher.subject}</p>
                                  <p className="text-[10px] text-indigo-600 font-medium">{teacher.name}</p>
                                </div>
                              ) : (
                                <i className="fas fa-check text-indigo-200 text-lg"></i>
                              )}
                              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <i className="fas fa-minus-circle text-slate-300 hover:text-slate-400"></i>
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {/* Print Only Layout */}
                    {DAYS.map(day => {
                      const slot = slots.find(s => s.day === day && s.period === period)!;
                      const teacher = getTeacher(slot.assignedTeacherId);
                      return (
                        <td key={`print-${day}-${period}`} className="hidden print-only p-2 border border-slate-300 h-16 text-center align-middle">
                          {teacher && (
                            <div>
                              <p className="text-sm font-bold">{teacher.subject}</p>
                              <p className="text-[10px]">{teacher.name}</p>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 justify-end no-print">
            <button 
              onClick={resetAssignments}
              className="px-4 py-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition"
            >
              배분 초기화
            </button>
          </div>

          <div className="bg-slate-800 text-slate-200 p-6 rounded-2xl no-print">
            <h3 className="font-bold flex items-center gap-2 mb-2">
              <i className="fas fa-info-circle text-indigo-400"></i>
              사용 방법
            </h3>
            <ul className="text-sm space-y-1 list-disc list-inside text-slate-400">
              <li>시간표의 특정 교시를 클릭하여 <span className="text-indigo-400 font-semibold">교담 가능 시간</span>으로 설정하세요.</li>
              <li>왼쪽 패널에서 교담 교사의 정보와 주당 시수를 입력하세요.</li>
              <li>상단의 <span className="text-white font-semibold">자동 배분 시작</span> 버튼을 눌러 시수를 자동으로 채우세요.</li>
              <li>배분된 결과는 인쇄 버튼을 통해 보관할 수 있습니다.</li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
