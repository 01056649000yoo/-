
import React, { useState, useMemo, useEffect } from 'react';
import { Teacher, Slot, Day, DAYS, PERIODS, GRADES, SUBJECTS } from './types';
import { autoGenerateSchedule } from './services/geminiService';
import { UserProfile, initGoogleAuth, saveToGoogleSheet, loadFromGoogleSheet } from './services/googleSheetsService';

// TODO: 여기에 본인의 구글 클라우드 콘솔 클라이언트 ID를 넣으세요.
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classCounts, setClassCounts] = useState<Record<number, number>>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
  });
  
  const [pendingCounts, setPendingCounts] = useState<Record<number, number>>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
  });

  const [gradeTemplates, setGradeTemplates] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number>(6);

  const [tokenClient, setTokenClient] = useState<any>(null);

  useEffect(() => {
    const checkGoogle = () => {
      if ((window as any).google) {
        const client = initGoogleAuth((u) => setUser(u), GOOGLE_CLIENT_ID);
        setTokenClient(client);
      } else {
        setTimeout(checkGoogle, 500);
      }
    };
    checkGoogle();
  }, []);

  const handleLogin = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    } else {
      alert('구글 서비스 로드 중입니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handleSaveToCloud = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    try {
      const appState = {
        teachers,
        classCounts,
        gradeTemplates: Array.from(gradeTemplates),
        slots
      };
      await saveToGoogleSheet(user.accessToken, appState);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (e) {
      setSyncStatus('error');
      alert('저장에 실패했습니다.');
    }
  };

  const handleLoadFromCloud = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    try {
      const data = await loadFromGoogleSheet(user.accessToken);
      if (data) {
        setTeachers(data.teachers || []);
        setClassCounts(data.classCounts || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
        setPendingCounts(data.classCounts || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
        setGradeTemplates(new Set(data.gradeTemplates || []));
        setSlots(data.slots || []);
        alert('데이터를 성공적으로 불러왔습니다.');
      } else {
        alert('저장된 데이터가 없습니다.');
      }
      setSyncStatus('idle');
    } catch (e) {
      setSyncStatus('error');
      alert('데이터를 불러오는데 실패했습니다.');
    }
  };

  const toggleTemplateSlot = (grade: number, day: Day, period: number) => {
    const key = `${grade}-${day}-${period}`;
    const newTemplates = new Set(gradeTemplates);
    if (newTemplates.has(key)) {
      newTemplates.delete(key);
    } else {
      newTemplates.add(key);
    }
    setGradeTemplates(newTemplates);
  };

  const applyClassCount = (grade: number) => {
    const count = pendingCounts[grade];
    if (count < 0) return;
    const message = count === 0 
      ? `${grade}학년의 모든 데이터를 삭제하시겠습니까?`
      : `${grade}학년 ${count}개 학급의 시간표를 새로 생성하시겠습니까?\n(기존 데이터가 초기화됩니다.)`;

    if (window.confirm(message)) {
      setClassCounts(prev => ({ ...prev, [grade]: count }));
      if (count === 0) {
        setSlots(prev => prev.filter(s => s.grade !== grade));
      } else {
        setSlots(prev => {
          const otherGradesSlots = prev.filter(s => s.grade !== grade);
          const newGradeSlots: Slot[] = [];
          for (let c = 1; c <= count; c++) {
            DAYS.forEach(day => {
              PERIODS.forEach(period => {
                const templateKey = `${grade}-${day}-${period}`;
                newGradeSlots.push({
                  grade, classNumber: c, day, period,
                  isAvailable: gradeTemplates.has(templateKey),
                  assignedTeacherId: null
                });
              });
            });
          }
          return [...otherGradesSlots, ...newGradeSlots];
        });
      }
    } else {
      setPendingCounts(prev => ({ ...prev, [grade]: classCounts[grade] }));
    }
  };

  const toggleClassSlotAvailability = (grade: number, classNum: number, day: Day, period: number) => {
    setSlots(prev => prev.map(s => 
      (s.grade === grade && s.classNumber === classNum && s.day === day && s.period === period) 
        ? { ...s, isAvailable: !s.isAvailable, assignedTeacherId: null } 
        : s
    ));
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState(SUBJECTS[0]);
  const [newTeacherHours, setNewTeacherHours] = useState<number>(1);
  const [newTeacherGrades, setNewTeacherGrades] = useState<number[]>([]);

  const getTeacher = (id: string | null) => teachers.find(t => t.id === id);
  const teacherStats = useMemo(() => {
    const stats: Record<string, number> = {};
    teachers.forEach(t => stats[t.id] = 0);
    slots.forEach(s => { if (s.assignedTeacherId) stats[s.assignedTeacherId] = (stats[s.assignedTeacherId] || 0) + 1; });
    return stats;
  }, [teachers, slots]);

  const stats = useMemo(() => {
    const required = teachers.reduce((sum, t) => sum + t.totalWeeklyHours, 0);
    const available = slots.filter(s => s.isAvailable).length;
    return { required, available };
  }, [teachers, slots]);

  const isTeacherConflicting = (teacherId: string, day: Day, period: number, grade: number, classNum: number) => {
    return slots.some(s => s.assignedTeacherId === teacherId && s.day === day && s.period === period && !(s.grade === grade && s.classNumber === classNum));
  };

  const assignTeacherToSlot = (grade: number, classNum: number, day: Day, period: number, teacherId: string | null) => {
    setSlots(prev => prev.map(s => (s.grade === grade && s.classNumber === classNum && s.day === day && s.period === period) ? { ...s, assignedTeacherId: teacherId } : s));
  };

  const addTeacher = () => {
    if (!newTeacherName || newTeacherGrades.length === 0) { alert("이름과 담당 학년을 선택해주세요."); return; }
    setTeachers([...teachers, { id: crypto.randomUUID(), name: newTeacherName, subject: newTeacherSubject, totalWeeklyHours: newTeacherHours, targetGrades: newTeacherGrades }]);
    setNewTeacherName(''); setNewTeacherGrades([]);
  };

  const handleAutoAssign = async () => {
    if (stats.required > stats.available) { alert(`확보된 시간(${stats.available}h)이 필요 시수(${stats.required}h)보다 부족합니다.`); return; }
    setIsGenerating(true);
    try {
      const assignment = await autoGenerateSchedule(teachers, slots);
      setSlots(prev => prev.map(s => {
        const key = `${s.grade}-${s.classNumber}-${s.day}-${s.period}`;
        return assignment[key] ? { ...s, assignedTeacherId: assignment[key] } : s;
      }));
    } finally { setIsGenerating(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <header className="max-w-[1600px] mx-auto mb-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between items-center gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-100">
            <i className="fas fa-calendar-check text-2xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">지능형 교담 설계 시스템</h1>
            <p className="text-slate-500 text-sm">스마트한 시수 배정과 구글 시트 클라우드 저장</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              {user.picture ? (
                <img src={user.picture} alt="" className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                  {user.name[0]}
                </div>
              )}
              <div className="hidden sm:block">
                <p className="text-xs font-bold text-slate-700">{user.name}님</p>
                <button onClick={handleLogout} className="text-[10px] text-red-400 hover:text-red-500 font-bold uppercase">Logout</button>
              </div>
              <div className="flex gap-1 ml-2">
                <button 
                  onClick={handleSaveToCloud} 
                  disabled={syncStatus === 'syncing'}
                  className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-50" 
                  title="구글 시트에 저장"
                >
                  <i className={`fas ${syncStatus === 'syncing' ? 'fa-sync fa-spin' : 'fa-cloud-upload-alt'}`}></i>
                </button>
                <button 
                  onClick={handleLoadFromCloud} 
                  disabled={syncStatus === 'syncing'}
                  className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50" 
                  title="구글 시트에서 불러오기"
                >
                  <i className="fas fa-cloud-download-alt"></i>
                </button>
              </div>
            </div>
          ) : (
            <button onClick={handleLogin} className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-sm text-slate-600 flex items-center gap-3 hover:bg-slate-50 transition-all shadow-sm">
              <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-5 h-5" alt="G" />
              구글 로그인하여 저장하기
            </button>
          )}

          <div className="h-10 w-px bg-slate-100 mx-2 hidden lg:block"></div>

          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">필요/가용</p>
              <p className="text-sm font-black text-slate-700">{stats.required} / {stats.available}h</p>
            </div>
            <button 
              onClick={handleAutoAssign}
              disabled={isGenerating || teachers.length === 0 || slots.length === 0}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 disabled:bg-slate-300"
            >
              {isGenerating ? <i className="fas fa-sync fa-spin"></i> : <i className="fas fa-magic"></i>}
              자동 배정
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
        <aside className="xl:col-span-3 space-y-6 no-print">
          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
              <i className="fas fa-users-rectangle text-slate-400"></i>
              학년별 학급 수
            </h2>
            <div className="space-y-3">
              {GRADES.map(g => (
                <div key={g} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-1">{g}학년</label>
                    <input 
                      type="number" min="0" max="15" 
                      value={pendingCounts[g]}
                      onChange={e => setPendingCounts({...pendingCounts, [g]: Number(e.target.value)})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-200 transition-all outline-none"
                    />
                  </div>
                  <button
                    onClick={() => applyClassCount(g)}
                    disabled={pendingCounts[g] === classCounts[g]}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${pendingCounts[g] !== classCounts[g] ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-300'}`}
                  >
                    확정
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
              <i className="fas fa-user-plus text-indigo-500"></i>
              교사 등록
            </h2>
            <div className="space-y-4">
              <input type="text" placeholder="교사 성함" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none text-sm" />
              <select value={newTeacherSubject} onChange={e => setNewTeacherSubject(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl outline-none text-sm cursor-pointer">
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="bg-slate-50 p-3 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 mb-2">담당 학년</p>
                <div className="flex flex-wrap gap-1">
                  {GRADES.map(g => (
                    <button key={g} onClick={() => setNewTeacherGrades(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${newTeacherGrades.includes(g) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-bold text-slate-500">주당 총 시수</span>
                <input type="number" value={newTeacherHours} onChange={e => setNewTeacherHours(Number(e.target.value))} className="w-12 text-right font-black text-indigo-600 bg-transparent border-none focus:ring-0" />
              </div>
              <button onClick={addTeacher} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-md">교사 등록</button>
            </div>
          </section>

          <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold mb-4 text-slate-800">배정 현황</h2>
            <div className="space-y-3">
              {teachers.map(t => {
                const current = teacherStats[t.id] || 0;
                const isOver = current > t.totalWeeklyHours;
                return (
                  <div key={t.id} className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm">{t.name}</span>
                      <span className={`text-[10px] font-bold ${isOver ? 'text-red-500' : 'text-indigo-600'}`}>{current} / {t.totalWeeklyHours}h</span>
                    </div>
                    <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full ${isOver ? 'bg-red-500' : 'bg-indigo-500'}`} style={{width: `${Math.min(100, (current/t.totalWeeklyHours)*100)}%`}} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        <main className="xl:col-span-9 space-y-10">
          <section className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4">
                <span className="text-[60px] font-black text-slate-50 leading-none pointer-events-none uppercase">Step 01</span>
             </div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <span className="bg-amber-400 w-6 h-6 rounded-full inline-flex items-center justify-center text-white text-xs">1</span>
                  학년별 공통 교담 시간 (템플릿)
                </h2>
                <p className="text-slate-400 text-sm mt-1">학년 전체가 공통으로 가용한 시간을 선택하세요.</p>
              </div>
              <div className="flex gap-1 bg-slate-100 p-1.5 rounded-2xl">
                {GRADES.map(g => (
                  <button key={g} onClick={() => setSelectedGrade(g)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedGrade === g ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    {g}학년
                  </button>
                ))}
              </div>
            </div>
            <div className="border border-amber-100 rounded-3xl overflow-hidden bg-amber-50/20 relative z-10">
              <table className="w-full text-center table-fixed">
                <thead>
                  <tr className="bg-amber-100/50">
                    <th className="w-16 py-3 text-amber-700 font-black text-sm">교시</th>
                    {DAYS.map(d => <th key={d} className="py-3 text-amber-800 font-black text-sm">{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map(p => (
                    <tr key={p} className="border-t border-amber-50">
                      <td className="py-4 font-black text-amber-600/50 bg-amber-50/30">{p}</td>
                      {DAYS.map(day => {
                        const key = `${selectedGrade}-${day}-${p}`;
                        const isActive = gradeTemplates.has(key);
                        return (
                          <td key={day} className={`p-1 cursor-pointer transition-all ${isActive ? 'bg-white' : 'hover:bg-amber-100/30'}`} onClick={() => toggleTemplateSlot(selectedGrade, day, p)}>
                            <div className={`h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${isActive ? 'bg-amber-400 border-amber-400 text-white shadow-lg shadow-amber-100' : 'bg-transparent border-dashed border-slate-200'}`}>
                              {isActive ? <i className="fas fa-check"></i> : <i className="fas fa-plus text-slate-200"></i>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="relative">
            <div className="absolute -top-6 right-4 pointer-events-none">
                <span className="text-[60px] font-black text-slate-100/60 leading-none uppercase">Step 02</span>
            </div>
            <div className="mb-6 px-4 relative z-10">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <span className="bg-indigo-500 w-6 h-6 rounded-full inline-flex items-center justify-center text-white text-xs">2</span>
                학급별 시간표 상세 수정 및 배정
              </h2>
              <p className="text-slate-400 text-sm mt-1">학급별로 특이사항이 있는 시간을 개별적으로 조정하세요.</p>
            </div>

            {classCounts[selectedGrade] > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                {Array.from({ length: classCounts[selectedGrade] }).map((_, idx) => {
                  const classNum = idx + 1;
                  const currentClassSlots = slots.filter(s => s.grade === selectedGrade && s.classNumber === classNum);
                  return (
                    <div key={classNum} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
                      <div className="flex justify-between items-center mb-5">
                        <h3 className="text-xl font-black text-slate-800">{selectedGrade}-{classNum} 학급</h3>
                        <span className="text-[10px] bg-indigo-50 text-indigo-500 px-2 py-1 rounded-lg font-bold">{currentClassSlots.filter(s => s.isAvailable).length}h 가용</span>
                      </div>
                      <div className="rounded-2xl border border-slate-100 overflow-hidden">
                        <table className="w-full text-[11px] table-fixed">
                          <thead><tr className="bg-slate-50 border-b border-slate-100"><th className="w-10 py-3 text-slate-400 font-bold">교시</th>{DAYS.map(d => <th key={d} className="py-3 text-slate-600 font-bold">{d}</th>)}</tr></thead>
                          <tbody>
                            {PERIODS.map(p => (
                              <tr key={p} className="border-b border-slate-50 last:border-0">
                                <td className="py-4 text-center text-slate-300 font-bold bg-slate-50/30">{p}</td>
                                {DAYS.map(day => {
                                  const slot = currentClassSlots.find(s => s.day === day && p === s.period);
                                  if (!slot) return <td key={day} className="bg-slate-50/50"></td>;
                                  const teacher = getTeacher(slot.assignedTeacherId);
                                  const hasConflict = slot.assignedTeacherId && isTeacherConflicting(slot.assignedTeacherId, day, p, selectedGrade, classNum);
                                  return (
                                    <td key={day} className={`relative group p-1 h-16 transition-colors ${slot.isAvailable ? (hasConflict ? 'bg-red-50' : 'bg-indigo-50/30') : 'bg-slate-50/50 hover:bg-indigo-50/20 cursor-pointer'}`} onClick={() => !slot.isAvailable && toggleClassSlotAvailability(selectedGrade, classNum, day, p)}>
                                      {slot.isAvailable ? (
                                        <div className="h-full w-full flex flex-col items-center justify-center">
                                          <select value={slot.assignedTeacherId || ""} onChange={(e) => assignTeacherToSlot(selectedGrade, classNum, day, p, e.target.value || null)} className={`w-full bg-transparent border-none text-center font-bold text-[10px] focus:ring-0 cursor-pointer p-0 appearance-none ${hasConflict ? 'text-red-500' : 'text-indigo-700'}`}>
                                            <option value="">(배정)</option>
                                            {teachers.filter(t => t.targetGrades.includes(selectedGrade)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                          </select>
                                          {teacher && <p className="text-[8px] text-slate-400 mt-1 font-medium leading-none">{teacher.subject}</p>}
                                          {hasConflict && <div className="absolute top-1 left-1"><i className="fas fa-exclamation-circle text-red-500 text-[8px]"></i></div>}
                                          <button onClick={(e) => { e.stopPropagation(); toggleClassSlotAvailability(selectedGrade, classNum, day, p); }} className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 text-[8px] text-slate-300 hover:text-red-400 transition-opacity"><i className="fas fa-times"></i></button>
                                        </div>
                                      ) : <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100"><i className="fas fa-plus text-indigo-300 text-[10px]"></i></div>}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border-2 border-dashed border-slate-200 p-12 rounded-[40px] text-center relative z-10">
                <div className="bg-slate-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-300"><i className="fas fa-plus-circle text-2xl"></i></div>
                <h3 className="text-slate-500 font-bold text-lg">먼저 사이드바에서 {selectedGrade}학년의 학급 수를 확정해주세요.</h3>
              </div>
            )}
          </section>
        </main>
      </div>
      <footer className="mt-16 max-w-[1600px] mx-auto text-center text-slate-400 text-xs no-print pb-8">
        &copy; 2024 Intelligent School Scheduler. 구글 클라우드와 연동되어 안전하게 데이터를 보관합니다.
      </footer>
    </div>
  );
};

export default App;
