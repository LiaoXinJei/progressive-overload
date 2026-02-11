import React, { useState, useEffect, useMemo } from 'react';
import { 
  RotateCcw, Activity, BarChart2, Calendar, Dumbbell, 
  AlertTriangle, BatteryCharging, TrendingUp, ShieldCheck 
} from 'lucide-react';

const RPWorkoutAppV3 = () => {
  // --- 狀態管理 ---
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);
  const [completedSets, setCompletedSets] = useState({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // 核心模式切換: 'maintenance' (維持/腿部專項) vs 'bulking' (增重/全身發展)
  const [trainingMode, setTrainingMode] = useState('maintenance');

  // --- 資料結構 ---
  const MUSCLE_GROUPS = {
    CHEST: '胸部',
    BACK: '背部',
    QUADS: '股四頭',
    HAMS: '腿後側',
    SIDE_DELT: '側三角',
    REAR_DELT: '後三角',
    TRICEPS: '三頭',
    BICEPS: '二頭',
    CALVES: '小腿',
    GLUTES: '臀部'
  };

  const BASE_ROUTINE = {
    1: { name: 'Upper A (上肢-重重量)', focus: '臥推/划船/側平舉', type: 'training', exercises: [
      { id: 'u1_chest', name: '槓鈴臥推', muscle: 'CHEST', baseSets: 3, isUpper: true },
      { id: 'u1_back', name: '槓鈴划船', muscle: 'BACK', baseSets: 3, isUpper: true },
      { id: 'u1_delt', name: '啞鈴側平舉', muscle: 'SIDE_DELT', baseSets: 3, isUpper: true },
      { id: 'u1_tri', name: '繩索下壓', muscle: 'TRICEPS', baseSets: 2, isUpper: true }
    ]},
    2: { name: 'Lower A (下肢-股四主導)', focus: '深蹲/腿推/小腿', type: 'training', exercises: [
      { id: 'l1_quad', name: '槓鈴深蹲', muscle: 'QUADS', baseSets: 4, isUpper: false },
      { id: 'l1_quad2', name: '腿推舉', muscle: 'QUADS', baseSets: 3, isUpper: false },
      { id: 'l1_calf', name: '站姿提踵', muscle: 'CALVES', baseSets: 3, isUpper: false }
    ]},
    3: { name: 'Rest / Active Recovery', focus: '完全休息或輕度有氧', type: 'rest', exercises: [] },
    4: { name: 'Upper B (上肢-代謝泵感)', focus: '上斜推/下拉/後肩', type: 'training', exercises: [
      { id: 'u2_chest', name: '上斜啞鈴推舉', muscle: 'CHEST', baseSets: 3, isUpper: true },
      { id: 'u2_back', name: '滑輪下拉', muscle: 'BACK', baseSets: 3, isUpper: true },
      { id: 'u2_rear', name: '反向飛鳥', muscle: 'REAR_DELT', baseSets: 3, isUpper: true },
      { id: 'u2_bi', name: '槓鈴彎舉', muscle: 'BICEPS', baseSets: 2, isUpper: true }
    ]},
    5: { name: 'Lower B (下肢-後側主導)', focus: '硬舉/單腿/臀部', type: 'training', exercises: [
      { id: 'l2_ham', name: '羅馬尼亞硬舉', muscle: 'HAMS', baseSets: 4, isUpper: false },
      { id: 'l2_glute', name: '保加利亞分腿蹲', muscle: 'GLUTES', baseSets: 3, isUpper: false },
      { id: 'l2_ham2', name: '腿彎舉', muscle: 'HAMS', baseSets: 3, isUpper: false }
    ]},
    6: { name: 'Rest Day', focus: '身體修復', type: 'rest', exercises: [] },
    7: { name: 'Rest Day', focus: '營養補充與準備下週', type: 'rest', exercises: [] }
  };

  // --- 核心邏輯: 根據模式計算組數 ---
  const calculateSets = (week, ex) => {
    const { baseSets, isUpper } = ex;

    // 減量週 (W5, W10)
    if (week === 5 || week === 10) return Math.max(1, Math.floor(baseSets * 0.5));

    if (trainingMode === 'maintenance') {
      // 維持模式: 上肢固定在 MV (維持量), 下肢進行遞增
      if (isUpper) {
        return baseSets; // 固定不變
      } else {
        // 下肢遞增路徑 (Meso 1: W1-W4; Meso 2: W6-W9)
        const progression = week <= 4? (week - 1) : (week - 6);
        return baseSets + Math.max(0, progression);
      }
    } else {
      // 增重模式: 全身同步遞增 (盈餘熱量支持)
      const progression = week <= 4? (week - 1) : (week - 6);
      return (baseSets + (week > 5? 1 : 0)) + Math.max(0, progression);
    }
  };

  const getWeeklyGuidance = (week) => {
    if (week === 5 || week === 10) return { rir: '4+', label: 'Deload', color: 'text-amber-400' };
    if (week === 4 || week === 9) return { rir: '0-1', label: 'Overreach', color: 'text-rose-500' };
    return { rir: '2-3', label: 'Accumulation', color: 'text-emerald-400' };
  };

  // --- 儲存邏輯 ---
  useEffect(() => {
    const saved = localStorage.getItem('rp_v3_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      setCompletedSets(parsed.progress || {});
      setTrainingMode(parsed.mode || 'maintenance');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('rp_v3_data', JSON.stringify({ progress: completedSets, mode: trainingMode }));
  }, [completedSets, trainingMode]);

  const toggleSet = (w, d, id, idx) => {
    const key = `${w}-${d}-${id}-${idx}`;
    setCompletedSets(p => ({...p, [key]:!p[key] }));
  };

  const resetData = () => {
    if (window.confirm("確定要重置所有數據嗎？")) {
      setCompletedSets({});
      setShowResetConfirm(false);
    }
  };

  // --- 統計數據 ---
  const weeklyVolume = useMemo(() => {
    const vol = {};
    Object.keys(MUSCLE_GROUPS).forEach(k => vol[k] = 0);
    [1, 2, 4, 5].forEach(d => {
      BASE_ROUTINE[d].exercises.forEach(ex => {
        vol[ex.muscle] += calculateSets(currentWeek, ex);
      });
    });
    return vol;
  }, [currentWeek, trainingMode]);

  const guidance = getWeeklyGuidance(currentWeek);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans pb-10">
      
      {/* Top Navigation & Mode Switcher */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h1 className="text-xl font-black italic tracking-tighter text-white flex items-center gap-2">
              <Dumbbell className="text-emerald-500" /> RP LOG V3.0
            </h1>
            
            {/* Mode Switcher */}
            <div className="flex bg-neutral-800 p-1 rounded-full border border-neutral-700 w-full md:w-auto">
              <button 
                onClick={() => setTrainingMode('maintenance')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2
                ${trainingMode === 'maintenance'? 'bg-blue-600 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                <ShieldCheck size={14} /> 維持模式 (腿部專項)
              </button>
              <button 
                onClick={() => setTrainingMode('bulking')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2
                ${trainingMode === 'bulking'? 'bg-orange-600 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                <TrendingUp size={14} /> 增重模式 (全身發展)
              </button>
            </div>

            <button onClick={() => setShowResetConfirm(true)} className="text-neutral-600 hover:text-red-500 transition-colors">
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Week Tabs */}
          <div className="flex space-x-2 overflow-x-auto py-4 no-scrollbar">
            {[...Array(10)].map((_, i) => {
              const w = i + 1;
              const isCurrent = currentWeek === w;
              return (
                <button
                  key={w}
                  onClick={() => setCurrentWeek(w)}
                  className={`flex-shrink-0 w-12 h-10 rounded-lg text-xs font-bold transition-all border
                  ${isCurrent? 'bg-white text-black border-white scale-110 shadow-lg' : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:border-neutral-500'}`}
                >
                  W{w}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 grid lg:grid-cols-12 gap-8">
        
        {/* Workout Area (Left) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Day Selector */}
          <div className="flex gap-2 justify-center">
            {['一', '二', '三', '四', '五', '六', '日'].map((d, i) => (
              <button
                key={i}
                onClick={() => setCurrentDay(i + 1)}
                className={`flex-1 py-3 rounded-xl text-sm font-black transition-all border
                ${currentDay === i + 1? 'bg-emerald-500 text-black border-emerald-500' : 'bg-neutral-900 border-neutral-800 text-neutral-600'}`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Training Info Box */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between
            ${currentWeek % 5 === 0? 'bg-amber-900/20 border-amber-800' : 'bg-emerald-900/20 border-emerald-800'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${currentWeek % 5 === 0? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black'}`}>
                <Activity size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold opacity-60">當前階段建議</p>
                <p className="font-black text-lg tracking-tight">{guidance.label} | {guidance.rir} RIR</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold opacity-60 uppercase">模式</p>
              <p className={`font-black uppercase tracking-widest ${trainingMode === 'bulking'? 'text-orange-500' : 'text-blue-500'}`}>
                {trainingMode}
              </p>
            </div>
          </div>

          {/* Exercise Card */}
          <div className="bg-neutral-900 rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-neutral-800 bg-neutral-800/30">
              <h2 className="text-2xl font-black text-white italic">{BASE_ROUTINE[currentDay].name}</h2>
              <p className="text-neutral-500 text-sm mt-1">{BASE_ROUTINE[currentDay].focus}</p>
            </div>

            <div className="divide-y divide-neutral-800">
              {BASE_ROUTINE[currentDay].exercises.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-neutral-600">
                  <BatteryCharging size={60} strokeWidth={1} className="mb-4" />
                  <p className="font-bold text-lg italic">休息日是成長的關鍵</p>
                  <p className="text-sm">確保水分攝取與 8 小時睡眠</p>
                </div>
              ) : (
                BASE_ROUTINE[currentDay].exercises.map((ex) => {
                  const setsCount = calculateSets(currentWeek, ex);
                  const isUpper = ex.isUpper;
                  const setsState = [...Array(setsCount)].map((_, i) => completedSets[`${currentWeek}-${currentDay}-${ex.id}-${i}`]);
                  const allDone = setsState.every(s => s);

                  return (
                    <div key={ex.id} className={`p-8 transition-all ${allDone ? 'bg-emerald-500/5 opacity-50' : ''}`}>
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isUpper? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                            <h3 className="text-xl font-bold text-neutral-100 leading-tight">{ex.name}</h3>
                          </div>
                          <span className="text-[10px] font-black bg-neutral-800 text-neutral-400 px-2 py-1 rounded mt-2 inline-block uppercase tracking-wider">
                            {MUSCLE_GROUPS[ex.muscle]}
                          </span>
                        </div>
                        <div className="text-3xl font-black font-mono text-neutral-700">
                          {setsCount}<span className="text-sm">Sets</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4">
                        {[...Array(setsCount)].map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => toggleSet(currentWeek, currentDay, ex.id, idx)}
                            className={`w-14 h-14 rounded-2xl border-4 flex items-center justify-center font-black text-lg transition-all
                            ${completedSets[`${currentWeek}-${currentDay}-${ex.id}-${idx}`]
                              ? 'bg-emerald-500 border-emerald-500 text-black scale-95'
                              : 'bg-transparent border-neutral-800 text-neutral-700 hover:border-neutral-600'}`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Sidebar (Right) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-6 sticky top-24 shadow-2xl">
            <h3 className="text-white font-black text-sm uppercase italic mb-6 flex items-center gap-2">
              <BarChart2 size={16} /> 本週預計總訓練量
            </h3>
            
            <div className="space-y-5">
              {Object.entries(weeklyVolume).map(([muscle, sets]) => {
                if (sets === 0) return null;
                const percentage = Math.min(100, (sets / 24) * 100);
                let color = 'bg-neutral-700';
                if (sets >= 18) color = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]';
                else if (sets >= 12) color = 'bg-emerald-500';
                else if (sets > 0) color = 'bg-blue-500';

                return (
                  <div key={muscle}>
                    <div className="flex justify-between text-[11px] font-black uppercase mb-1.5 opacity-80">
                      <span>{MUSCLE_GROUPS[muscle]}</span>
                      <span className="font-mono">{sets} 組</span>
                    </div>
                    <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 p-4 bg-neutral-800/50 rounded-2xl border border-neutral-700 text-[11px] leading-relaxed text-neutral-400">
              <p className="text-white font-bold mb-2 flex items-center gap-2 italic">
                <TrendingUp size={12}/> 模式說明:
              </p>
              {trainingMode === 'maintenance'? (
                <p>上肢固定在最低維持組數（MV），讓神經系統資源專注於腿部的爆發性增長。適合不希望體重增加的時期。</p>
              ) : (
                <p>全面進攻！盈餘熱量會提升您的恢復力，這週所有部位都會同步增加組數挑戰極限。請確保槓鈴上的重量也在增加。</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z- flex items-center justify-center p-6">
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[40px] max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-2xl font-black text-white mb-4 italic uppercase">Reset All?</h3>
            <p className="text-neutral-500 mb-8 text-sm font-medium">重置將會清除所有週次的訓練打勾紀錄，讓您重新開始一個新的週期。</p>
            <div className="flex gap-4">
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-4 rounded-2xl bg-neutral-800 text-white font-black uppercase tracking-widest text-xs hover:bg-neutral-700 transition-all">Cancel</button>
              <button onClick={resetData} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest text-xs hover:bg-red-500 transition-all shadow-lg shadow-red-900/50">Reset Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RPWorkoutAppV3;