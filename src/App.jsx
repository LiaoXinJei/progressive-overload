import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw, Activity, BarChart2, ChevronDown, ChevronUp,
  AlertTriangle, TrendingUp, ShieldCheck, Plus, Minus, Check
} from 'lucide-react';

const RPFocusPro = () => {
  // ==================== 狀態管理 ====================
  const [logs, setLogs] = useState({});           // 訓練日誌：{ "w1-d0-bp_flat-s0": { weight: 100, reps: 10, done: true } }
  const [history, setHistory] = useState({});     // 歷史記錄：{ "bp_flat": 100 } (用於 Auto-Fill)
  const [mode, setMode] = useState('maintenance'); // 'maintenance' | 'bulking'
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentDay, setCurrentDay] = useState(0);  // 0-3 (Day 0, Day 1, Day 2, Day 3)
  const [showStats, setShowStats] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ==================== 5-Day Rotation Model ====================
  const WORKOUTS = {
    A: {
      name: 'PUSH A',
      subtitle: '胸主導 + 三頭',
      type: 'push',
      exercises: [
        { id: 'bp_flat', name: '平板槓鈴臥推', muscle: 'CHEST', baseSets: 4, isUpper: true },
        { id: 'bp_incline', name: '上斜啞鈴臥推', muscle: 'CHEST', baseSets: 3, isUpper: true },
        { id: 'fly_cable', name: '繩索飛鳥', muscle: 'CHEST', baseSets: 3, isUpper: true },
        { id: 'tri_pushdown', name: '繩索三頭下壓', muscle: 'TRICEPS', baseSets: 3, isUpper: true },
        { id: 'tri_overhead', name: '過頭三頭伸展', muscle: 'TRICEPS', baseSets: 2, isUpper: true }
      ]
    },
    B: {
      name: 'PULL A',
      subtitle: '背部厚度主導 + 二頭',
      type: 'pull',
      exercises: [
        { id: 'bb_row', name: '槓鈴划船', muscle: 'BACK', baseSets: 4, isUpper: true },
        { id: 'pulldown', name: '滑輪下拉', muscle: 'BACK', baseSets: 3, isUpper: true },
        { id: 'db_row', name: '單臂啞鈴划船', muscle: 'BACK', baseSets: 3, isUpper: true },
        { id: 'bi_curl', name: '槓鈴彎舉', muscle: 'BICEPS', baseSets: 3, isUpper: true },
        { id: 'bi_hammer', name: '錘式彎舉', muscle: 'BICEPS', baseSets: 2, isUpper: true }
      ]
    },
    C: {
      name: 'PUSH B',
      subtitle: '肩膀主導 + 上胸',
      type: 'push',
      exercises: [
        { id: 'ohp', name: '站姿肩推', muscle: 'SHOULDERS', baseSets: 4, isUpper: true },
        { id: 'lateral_raise', name: '啞鈴側平舉', muscle: 'SIDE_DELT', baseSets: 4, isUpper: true },
        { id: 'bp_incline_bb', name: '上斜槓鈴臥推', muscle: 'CHEST', baseSets: 3, isUpper: true },
        { id: 'tri_dips', name: '三頭臂屈伸', muscle: 'TRICEPS', baseSets: 3, isUpper: true }
      ]
    },
    D: {
      name: 'PULL B',
      subtitle: '背部細節主導 + 後三角',
      type: 'pull',
      exercises: [
        { id: 'pullup', name: '引體向上', muscle: 'BACK', baseSets: 3, isUpper: true },
        { id: 'cable_row', name: '坐姿划船', muscle: 'BACK', baseSets: 3, isUpper: true },
        { id: 'face_pull', name: '繩索面拉', muscle: 'REAR_DELT', baseSets: 3, isUpper: true },
        { id: 'rear_fly', name: '反向飛鳥', muscle: 'REAR_DELT', baseSets: 3, isUpper: true },
        { id: 'bi_cable', name: '繩索彎舉', muscle: 'BICEPS', baseSets: 2, isUpper: true }
      ]
    },
    E: {
      name: 'LEGS',
      subtitle: '下肢功能維持',
      type: 'legs',
      exercises: [
        { id: 'sq_low_bar', name: '低槓深蹲', muscle: 'QUADS', baseSets: 3, isUpper: false },
        { id: 'rdl', name: '羅馬尼亞硬舉', muscle: 'HAMS', baseSets: 3, isUpper: false },
        { id: 'leg_press', name: '腿推舉', muscle: 'QUADS', baseSets: 2, isUpper: false },
        { id: 'calf_raise', name: '站姿提踵', muscle: 'CALVES', baseSets: 3, isUpper: false }
      ]
    }
  };

  const MUSCLE_GROUPS = {
    CHEST: '胸部',
    BACK: '背部',
    SHOULDERS: '肩膀',
    SIDE_DELT: '側三角',
    REAR_DELT: '後三角',
    TRICEPS: '三頭',
    BICEPS: '二頭',
    QUADS: '股四頭',
    HAMS: '腿後側',
    CALVES: '小腿'
  };

  // ==================== 核心邏輯函數 ====================

  /**
   * 計算當前週次的第 N 天應該執行哪個菜單
   * @param {number} week - 週次 (1-10)
   * @param {number} dayIndex - 天數索引 (0-3)
   * @returns {string} - 菜單鍵 ('A', 'B', 'C', 'D', 'E')
   */
  const getWorkoutForDay = (week, dayIndex) => {
    const offset = ((week - 1) * 4) % 5;
    const workoutIndex = (offset + dayIndex) % 5;
    const workoutKeys = ['A', 'B', 'C', 'D', 'E'];
    return workoutKeys[workoutIndex];
  };

  /**
   * 根據週次、動作和模式計算組數
   * PRD 2.2 節邏輯：
   * - 維持模式：上肢遞增（追求 MAV），下肢固定（MEV）
   * - 增重模式：上肢額外 +1 且遞增，下肢每 4 週 +1
   */
  const calculateSets = (week, exercise, trainingMode) => {
    const { baseSets, isUpper } = exercise;

    // 減量週 (W5, W10)：所有肌群 50% 組數
    if (week === 5 || week === 10) {
      return Math.max(1, Math.floor(baseSets * 0.5));
    }

    // 計算當前 Meso 週次 (W1-W4 為 Meso 1；W6-W9 為 Meso 2)
    const mesoWeek = week <= 4 ? week : (week - 5);

    if (trainingMode === 'maintenance') {
      if (isUpper) {
        // 上肢：每週 +1 組（W1: baseSets, W2: baseSets+1, ...）
        return baseSets + (mesoWeek - 1);
      } else {
        // 下肢：固定 MEV，組數不增加
        return baseSets;
      }
    } else { // bulking
      if (isUpper) {
        // 上肢：起始容量 +1（W6 後額外 +1），每週 +1 組
        const bonus = week > 5 ? 1 : 0;
        return baseSets + bonus + (mesoWeek - 1);
      } else {
        // 下肢：每 4 週 +1 組
        const bonus = Math.floor((week - 1) / 4);
        return baseSets + bonus;
      }
    }
  };

  /**
   * 獲取當前週的訓練指引（RIR 建議）
   */
  const getWeeklyGuidance = (week) => {
    if (week === 5 || week === 10) return { rir: '4+', label: 'Deload', color: 'text-amber-400' };
    if (week === 4 || week === 9) return { rir: '0-1', label: 'Overreach', color: 'text-rose-500' };
    return { rir: '2-3', label: 'Accumulation', color: 'text-emerald-400' };
  };

  // ==================== 數據持久化 ====================

  // 初始化：從 localStorage 載入數據
  useEffect(() => {
    const saved = localStorage.getItem('rp_focus_pro_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setLogs(data.logs || {});
        setHistory(data.history || {});
        setMode(data.mode || 'maintenance');
        setCurrentWeek(data.viewState?.currentWeek || 1);
        setCurrentDay(data.viewState?.currentDay || 0);
        setShowStats(data.viewState?.showStats ?? true);
      } catch (e) {
        console.error('載入數據失敗:', e);
      }
    }
  }, []);

  // 自動儲存：每次狀態更新時
  useEffect(() => {
    const state = {
      logs,
      history,
      mode,
      viewState: {
        currentWeek,
        currentDay,
        showStats
      }
    };
    localStorage.setItem('rp_focus_pro_data', JSON.stringify(state));
  }, [logs, history, mode, currentWeek, currentDay, showStats]);

  // ==================== 訓練記錄操作 ====================

  /**
   * 更新訓練日誌（重量或次數）
   */
  const updateLog = (logKey, field, value) => {
    setLogs(prev => ({
      ...prev,
      [logKey]: {
        ...prev[logKey],
        [field]: value
      }
    }));
  };

  /**
   * 快速調整重量（+/- 2.5kg）
   */
  const adjustWeight = (logKey, delta) => {
    setLogs(prev => {
      const current = prev[logKey] || {};
      const newWeight = (parseFloat(current.weight) || 0) + delta;
      return {
        ...prev,
        [logKey]: {
          ...current,
          weight: Math.max(0, newWeight)
        }
      };
    });
  };

  /**
   * 完成組數（Auto-Fill 邏輯）
   */
  const completeSet = (logKey, exerciseId) => {
    setLogs(prev => {
      const current = prev[logKey] || {};

      // Auto-Fill：若重量為空，使用歷史記錄
      const weight = current.weight || history[exerciseId] || '';

      const newDone = !current.done;

      // 更新 history（記錄最後一次重量）
      if (newDone && weight) {
        setHistory(h => ({ ...h, [exerciseId]: parseFloat(weight) }));
      }

      return {
        ...prev,
        [logKey]: {
          ...current,
          weight,
          done: newDone
        }
      };
    });
  };

  /**
   * 重置所有數據
   */
  const resetData = () => {
    setLogs({});
    setHistory({});
    setCurrentWeek(1);
    setCurrentDay(0);
    setShowResetConfirm(false);
  };

  // ==================== 統計計算 ====================

  const weeklyVolume = useMemo(() => {
    const vol = {};
    Object.keys(MUSCLE_GROUPS).forEach(k => vol[k] = 0);

    // 計算當前週次，4 天訓練會執行哪些菜單
    [0, 1, 2, 3].forEach(dayIndex => {
      const workoutKey = getWorkoutForDay(currentWeek, dayIndex);
      const workout = WORKOUTS[workoutKey];

      workout.exercises.forEach(ex => {
        const sets = calculateSets(currentWeek, ex, mode);
        vol[ex.muscle] = (vol[ex.muscle] || 0) + sets;
      });
    });

    return vol;
  }, [currentWeek, mode]);

  // ==================== 渲染邏輯 ====================

  const workoutKey = getWorkoutForDay(currentWeek, currentDay);
  const currentWorkout = WORKOUTS[workoutKey];
  const guidance = getWeeklyGuidance(currentWeek);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans pb-10">

      {/* ==================== Header ==================== */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">

            {/* Logo */}
            <h1 className="text-xl font-black italic tracking-tighter text-white flex items-center gap-2">
              <Activity className="text-emerald-500" /> RP FOCUS PRO
            </h1>

            {/* Mode Switcher */}
            <div className="flex bg-neutral-800 p-1 rounded-full border border-neutral-700 w-full md:w-auto">
              <button
                onClick={() => setMode('maintenance')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2
                ${mode === 'maintenance' ? 'bg-blue-600 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                <ShieldCheck size={14} /> 維持模式
              </button>
              <button
                onClick={() => setMode('bulking')}
                className={`flex-1 md:flex-none px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2
                ${mode === 'bulking' ? 'bg-orange-600 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                <TrendingUp size={14} /> 增重模式
              </button>
            </div>

            {/* Reset Button */}
            <button
              onClick={() => setShowResetConfirm(true)}
              className="text-neutral-600 hover:text-red-500 transition-colors"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Week Tabs */}
          <div className="flex space-x-2 overflow-x-auto py-4 no-scrollbar">
            {[...Array(10)].map((_, i) => {
              const w = i + 1;
              const isCurrent = currentWeek === w;
              const isDeload = w === 5 || w === 10;
              return (
                <button
                  key={w}
                  onClick={() => setCurrentWeek(w)}
                  className={`flex-shrink-0 w-12 h-10 rounded-lg text-xs font-bold transition-all border
                  ${isCurrent
                    ? 'bg-white text-black border-white scale-110 shadow-lg'
                    : isDeload
                    ? 'bg-amber-900 text-amber-400 border-amber-700 hover:border-amber-500'
                    : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:border-neutral-500'}`}
                >
                  W{w}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-12 gap-8">

        {/* ==================== 訓練區域 (左側) ==================== */}
        <div className="lg:col-span-8 space-y-6">

          {/* Day Selector (0-3) */}
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(d => {
              const wKey = getWorkoutForDay(currentWeek, d);
              const workout = WORKOUTS[wKey];
              return (
                <button
                  key={d}
                  onClick={() => setCurrentDay(d)}
                  className={`py-4 px-3 rounded-xl text-sm font-black transition-all border flex flex-col items-center gap-1
                  ${currentDay === d
                    ? 'bg-emerald-500 text-black border-emerald-500 shadow-lg'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-600 hover:border-neutral-600'}`}
                >
                  <div className="text-xs opacity-60 font-normal">Day {d + 1}</div>
                  <div className="text-2xl">{wKey}</div>
                  <div className="text-[10px] font-normal opacity-75">{workout.name}</div>
                </button>
              );
            })}
          </div>

          {/* Training Info Box */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between
            ${currentWeek % 5 === 0 ? 'bg-amber-900/20 border-amber-800' : 'bg-emerald-900/20 border-emerald-800'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${currentWeek % 5 === 0 ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black'}`}>
                <Activity size={20} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold opacity-60">當前階段建議</p>
                <p className="font-black text-lg tracking-tight">{guidance.label} | {guidance.rir} RIR</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold opacity-60 uppercase">週次 {currentWeek} · {currentWorkout.name}</p>
              <p className="text-xs text-neutral-500">{currentWorkout.subtitle}</p>
            </div>
          </div>

          {/* Exercise Card */}
          <div className="bg-neutral-900 rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-neutral-800 bg-neutral-800/30">
              <h2 className="text-2xl font-black text-white italic">{currentWorkout.name}</h2>
              <p className="text-neutral-500 text-sm mt-1">{currentWorkout.subtitle}</p>
            </div>

            <div className="divide-y divide-neutral-800">
              {currentWorkout.exercises.map((ex) => {
                const setsCount = calculateSets(currentWeek, ex, mode);

                // 計算完成度
                const completedCount = [...Array(setsCount)].filter((_, idx) => {
                  const logKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx}`;
                  return logs[logKey]?.done;
                }).length;
                const allDone = completedCount === setsCount;

                return (
                  <div key={ex.id} className={`p-6 transition-all ${allDone ? 'bg-emerald-500/5 opacity-60' : ''}`}>

                    {/* Exercise Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${ex.isUpper ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                          <h3 className="text-lg font-bold text-neutral-100">{ex.name}</h3>
                        </div>
                        <span className="text-[10px] font-black bg-neutral-800 text-neutral-400 px-2 py-1 rounded mt-2 inline-block uppercase tracking-wider">
                          {MUSCLE_GROUPS[ex.muscle]}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black font-mono text-neutral-700">
                          {setsCount}<span className="text-sm ml-1">組</span>
                        </div>
                        <div className="text-xs text-neutral-600">
                          {completedCount}/{setsCount} 完成
                        </div>
                      </div>
                    </div>

                    {/* Sets List */}
                    <div className="space-y-3">
                      {[...Array(setsCount)].map((_, idx) => {
                        const logKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx}`;
                        const logData = logs[logKey] || {};
                        const historyWeight = history[ex.id];

                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all
                            ${logData.done
                              ? 'bg-emerald-500/10 border border-emerald-500/30'
                              : 'bg-neutral-800/30 border border-neutral-800'}`}
                          >
                            {/* Set Number */}
                            <div className="text-xl font-black text-neutral-600 w-8 text-center">
                              {idx + 1}
                            </div>

                            {/* Weight Input */}
                            <div className="flex-1">
                              <label className="text-[10px] text-neutral-500 block mb-1">重量 (kg)</label>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => adjustWeight(logKey, -2.5)}
                                  className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  type="number"
                                  step="2.5"
                                  value={logData.weight || ''}
                                  onChange={(e) => updateLog(logKey, 'weight', e.target.value)}
                                  placeholder={historyWeight ? String(historyWeight) : '—'}
                                  className="w-20 bg-neutral-900 px-3 py-2 rounded-lg text-center font-mono text-sm
                                  focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <button
                                  onClick={() => adjustWeight(logKey, 2.5)}
                                  className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Reps Input */}
                            <div className="flex-1">
                              <label className="text-[10px] text-neutral-500 block mb-1">次數</label>
                              <input
                                type="number"
                                value={logData.reps || ''}
                                onChange={(e) => updateLog(logKey, 'reps', e.target.value)}
                                placeholder="—"
                                className="w-full bg-neutral-900 px-3 py-2 rounded-lg text-center font-mono text-sm
                                focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>

                            {/* Complete Button */}
                            <button
                              onClick={() => completeSet(logKey, ex.id)}
                              className={`p-3 rounded-lg transition-all flex items-center justify-center
                              ${logData.done
                                ? 'bg-emerald-500 text-black shadow-lg'
                                : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'}`}
                            >
                              <Check size={20} strokeWidth={3} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ==================== 統計面板 (右側) ==================== */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-6 sticky top-24 shadow-2xl">

            {/* Header with Toggle */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-black text-sm uppercase italic flex items-center gap-2">
                <BarChart2 size={16} /> 本週訓練量
              </h3>
              <button
                onClick={() => setShowStats(!showStats)}
                className="text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                {showStats ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            {showStats && (
              <>
                <div className="space-y-4 mb-6">
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

                {/* Mode Description */}
                <div className="p-4 bg-neutral-800/50 rounded-2xl border border-neutral-700 text-[11px] leading-relaxed text-neutral-400">
                  <p className="text-white font-bold mb-2 flex items-center gap-2 italic">
                    <TrendingUp size={12}/> 模式說明
                  </p>
                  {mode === 'maintenance' ? (
                    <p>維持模式：上肢每週遞增組數（追求 MAV），下肢固定最低維持量（MEV）。專注於上肢發展，適合不希望體重增加的時期。</p>
                  ) : (
                    <p>增重模式：上肢起始容量 +1 且每週遞增，下肢每 4 週 +1 組。全面進攻，確保盈餘熱量支持恢復。</p>
                  )}
                </div>

                {/* 5-Day Rotation Info */}
                <div className="mt-4 p-4 bg-blue-900/20 rounded-2xl border border-blue-800 text-[11px] leading-relaxed text-neutral-400">
                  <p className="text-blue-400 font-bold mb-2 uppercase tracking-wide">
                    本週循環
                  </p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[0, 1, 2, 3].map(d => {
                      const wKey = getWorkoutForDay(currentWeek, d);
                      return (
                        <div key={d} className="bg-neutral-900/50 rounded-lg py-2">
                          <div className="text-[9px] text-neutral-600">D{d + 1}</div>
                          <div className="text-lg font-black">{wKey}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* ==================== Reset Modal ==================== */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[40px] max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-2xl font-black text-white mb-4 italic uppercase">重置所有數據？</h3>
            <p className="text-neutral-500 mb-8 text-sm font-medium">
              這將清除所有訓練記錄、重量歷史和進度。此操作無法復原。
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-4 rounded-2xl bg-neutral-800 text-white font-black uppercase tracking-widest text-xs hover:bg-neutral-700 transition-all"
              >
                取消
              </button>
              <button
                onClick={resetData}
                className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest text-xs hover:bg-red-500 transition-all shadow-lg shadow-red-900/50"
              >
                確定重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RPFocusPro;
