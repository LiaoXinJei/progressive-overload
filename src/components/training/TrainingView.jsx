import React, { useState, useMemo } from 'react';
import {
  Activity, BarChart2, ChevronDown, ChevronUp,
  TrendingUp, ShieldCheck, Plus, Minus, Check,
  Edit2, Save
} from 'lucide-react';
import { WORKOUTS, MUSCLE_GROUPS } from '../../constants/workouts';

const TrainingView = ({
  logs, setLogs,
  history, setHistory,
  mode, currentWeek, currentDay, setCurrentDay,
  showStats, setShowStats,
  customExerciseNames, setCustomExerciseNames,
  weightIncrement,
  currentTime
}) => {
  const [editingExercise, setEditingExercise] = useState(null);

  // ==================== 核心邏輯函數 ====================

  const getWorkoutForDay = (week, dayIndex) => {
    const offset = ((week - 1) * 4) % 5;
    const workoutIndex = (offset + dayIndex) % 5;
    const workoutKeys = ['A', 'B', 'C', 'D', 'E'];
    return workoutKeys[workoutIndex];
  };

  const calculateSets = (week, exercise, trainingMode) => {
    const { baseSets, isUpper, muscle } = exercise;
    if (week === 5 || week === 10) {
      return Math.max(1, Math.floor(baseSets * 0.5));
    }
    const mesoWeek = week <= 4 ? week : (week - 5);
    let calculatedSets;
    if (trainingMode === 'maintenance') {
      if (isUpper) {
        calculatedSets = baseSets + (mesoWeek - 1);
      } else {
        calculatedSets = baseSets;
      }
    } else {
      if (isUpper) {
        const bonus = week > 5 ? 1 : 0;
        calculatedSets = baseSets + bonus + (mesoWeek - 1);
      } else {
        const bonus = Math.floor((week - 1) / 4);
        calculatedSets = baseSets + bonus;
      }
    }
    const isSmallMuscle = muscle === 'SIDE_DELT' || muscle === 'REAR_DELT' || muscle === 'CALVES';
    const ceiling = isSmallMuscle ? 8 : 6;
    return Math.min(calculatedSets, ceiling);
  };

  const getWeeklyGuidance = (week) => {
    if (week === 5 || week === 10) return { rir: '4+', label: 'Deload', color: 'text-amber-400' };
    if (week === 4 || week === 9) return { rir: '0-1', label: 'Overreach', color: 'text-rose-500' };
    return { rir: '2-3', label: 'Accumulation', color: 'text-emerald-400' };
  };

  // ==================== 工具函數 ====================

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateRestTime = (currentLogKey, previousLogKey) => {
    const currentLog = logs[currentLogKey];
    const previousLog = logs[previousLogKey];
    if (!currentLog?.completedAt || !previousLog?.completedAt) return null;
    const restSeconds = Math.floor((currentLog.completedAt - previousLog.completedAt) / 1000);
    return formatTime(restSeconds);
  };

  const getCurrentRestTime = (previousLogKey) => {
    const previousLog = logs[previousLogKey];
    if (!previousLog?.completedAt) return null;
    const restSeconds = Math.floor((currentTime - previousLog.completedAt) / 1000);
    return formatTime(restSeconds);
  };

  // ==================== 訓練記錄操作 ====================

  const updateLog = (logKey, field, value) => {
    setLogs(prev => ({
      ...prev,
      [logKey]: { ...prev[logKey], [field]: value }
    }));
  };

  const adjustWeight = (logKey, direction) => {
    setLogs(prev => {
      const current = prev[logKey] || {};
      const delta = direction * weightIncrement;
      const newWeight = (parseFloat(current.weight) || 0) + delta;
      return {
        ...prev,
        [logKey]: { ...current, weight: Math.max(0, newWeight) }
      };
    });
  };

  const completeSet = (logKey, exerciseId) => {
    setLogs(prev => {
      const current = prev[logKey] || {};
      const weight = current.weight || history[exerciseId] || '';
      const newDone = !current.done;
      if (newDone && weight) {
        setHistory(h => ({ ...h, [exerciseId]: parseFloat(weight) }));
      }
      return {
        ...prev,
        [logKey]: {
          ...current, weight, done: newDone,
          completedAt: newDone ? Date.now() : undefined
        }
      };
    });
  };

  const saveCustomName = (exerciseId, customName) => {
    if (customName.trim()) {
      setCustomExerciseNames(prev => ({ ...prev, [exerciseId]: customName.trim() }));
    } else {
      setCustomExerciseNames(prev => {
        const updated = { ...prev };
        delete updated[exerciseId];
        return updated;
      });
    }
    setEditingExercise(null);
  };

  // ==================== 統計計算 ====================

  const weeklyVolume = useMemo(() => {
    const vol = {};
    Object.keys(MUSCLE_GROUPS).forEach(k => vol[k] = 0);
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

  // ==================== 渲染 ====================

  const workoutKey = getWorkoutForDay(currentWeek, currentDay);
  const currentWorkout = WORKOUTS[workoutKey];
  const guidance = getWeeklyGuidance(currentWeek);

  return (
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
            {currentWorkout.exercises.map((ex, exIdx) => {
              const setsCount = calculateSets(currentWeek, ex, mode);
              const completedCount = [...Array(setsCount)].filter((_, idx) => {
                const logKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx}`;
                return logs[logKey]?.done;
              }).length;
              const allDone = completedCount === setsCount;

              const firstSetKey = `w${currentWeek}-d${currentDay}-${ex.id}-s0`;
              const firstSetLog = logs[firstSetKey];
              let previousExerciseLastSetKey = null;

              if (exIdx > 0) {
                const prevEx = currentWorkout.exercises[exIdx - 1];
                const prevSetsCount = calculateSets(currentWeek, prevEx, mode);
                previousExerciseLastSetKey = `w${currentWeek}-d${currentDay}-${prevEx.id}-s${prevSetsCount - 1}`;
              }

              return (
                <div key={ex.id} className={`p-6 transition-all ${allDone ? 'bg-emerald-500/5 opacity-60' : ''}`}>

                  {/* Exercise Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${ex.isUpper ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                        {editingExercise === ex.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              defaultValue={customExerciseNames[ex.id] || ex.name}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCustomName(ex.id, e.target.value);
                                else if (e.key === 'Escape') setEditingExercise(null);
                              }}
                              autoFocus
                              className="bg-neutral-800 px-2 py-1 rounded text-lg font-bold text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button
                              onClick={(e) => {
                                const input = e.currentTarget.previousSibling;
                                saveCustomName(ex.id, input.value);
                              }}
                              className="text-emerald-500 hover:text-emerald-400 transition-colors"
                              title="儲存"
                            >
                              <Save size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <h3 className="text-lg font-bold text-neutral-100">
                              {customExerciseNames[ex.id] || ex.name}
                            </h3>
                            <button
                              onClick={() => setEditingExercise(ex.id)}
                              className="text-neutral-600 hover:text-neutral-400 transition-colors"
                              title="編輯動作名稱"
                            >
                              <Edit2 size={14} />
                            </button>
                          </>
                        )}
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

                  {/* Inter-Exercise Rest Time */}
                  {previousExerciseLastSetKey && (() => {
                    const prevLastSetLog = logs[previousExerciseLastSetKey];
                    if (prevLastSetLog?.completedAt && !firstSetLog?.done) {
                      const interExerciseRestTime = getCurrentRestTime(previousExerciseLastSetKey);
                      return (
                        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800 rounded-xl">
                          <div className="text-sm text-blue-400 font-semibold animate-pulse flex items-center gap-2">
                            動作間休息: {interExerciseRestTime}
                          </div>
                        </div>
                      );
                    }
                    if (prevLastSetLog?.completedAt && firstSetLog?.completedAt) {
                      const interExerciseRestTime = calculateRestTime(firstSetKey, previousExerciseLastSetKey);
                      return interExerciseRestTime ? (
                        <div className="mb-4 p-3 bg-neutral-800/50 border border-neutral-700 rounded-xl">
                          <div className="text-sm text-neutral-500 flex items-center gap-2">
                            動作間休息: {interExerciseRestTime}
                          </div>
                        </div>
                      ) : null;
                    }
                    return null;
                  })()}

                  {/* Sets List */}
                  <div className="space-y-3">
                    {[...Array(setsCount)].map((_, idx) => {
                      const logKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx}`;
                      const logData = logs[logKey] || {};
                      const historyWeight = history[ex.id];

                      return (
                        <React.Fragment key={idx}>
                          <div
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all
                            ${logData.done
                              ? 'bg-emerald-500/10 border border-emerald-500/30'
                              : 'bg-neutral-800/30 border border-neutral-800'}`}
                          >
                            <div className="text-xl font-black text-neutral-600 w-8 text-center">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-neutral-500 block mb-1">重量 (kg)</label>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => adjustWeight(logKey, -1)}
                                  className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
                                  title={`-${weightIncrement}kg`}
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  type="number"
                                  step={weightIncrement}
                                  value={logData.weight || ''}
                                  onChange={(e) => updateLog(logKey, 'weight', e.target.value)}
                                  placeholder={historyWeight ? String(historyWeight) : '—'}
                                  className="w-20 bg-neutral-900 px-3 py-2 rounded-lg text-center font-mono text-sm
                                  focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <button
                                  onClick={() => adjustWeight(logKey, 1)}
                                  className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
                                  title={`+${weightIncrement}kg`}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
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

                          {/* Rest Time Display */}
                          {(() => {
                            const isLastSet = idx === setsCount - 1;
                            const nextLogKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx + 1}`;
                            const nextLog = logs[nextLogKey];

                            if (logData.done && !isLastSet && nextLog?.done) {
                              const restTime = calculateRestTime(nextLogKey, logKey);
                              return restTime ? (
                                <div className="text-xs text-neutral-500 mt-1 pl-11">
                                  休息時間: {restTime}
                                </div>
                              ) : null;
                            }
                            if (logData.done && !isLastSet && !nextLog?.done) {
                              const cRestTime = getCurrentRestTime(logKey);
                              return (
                                <div className="text-xs text-emerald-400 mt-1 pl-11 font-semibold animate-pulse">
                                  休息中: {cRestTime}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </React.Fragment>
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
  );
};

export default TrainingView;
